import { mergeStatements } from "@openuidev/lang-core";
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jsonResult } from "openclaw/plugin-sdk/agent-runtime";
import type {
  GatewayRequestHandlerOptions,
  OpenClawPluginToolContext,
} from "openclaw/plugin-sdk/core";
import {
  definePluginEntry,
  emptyPluginConfigSchema,
} from "openclaw/plugin-sdk/plugin-entry";
import { AppStore } from "./app-store.js";
import { ArtifactStore } from "./artifact-store.js";
import { runDbExecute, runDbQuery } from "./db.js";
import { lintOpenUICode, type LintReport } from "./lint-openui.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Session-key suffix that scopes Campfire-originating sessions. The Campfire
// web client encodes session keys as `agent:<id>:main:campfire`; this plugin
// hook only fires for those, so other clients (CLI, scripts, openclaw-os-
// plugin sessions, …) on the same gateway are untouched.
const CAMPFIRE_SUFFIX = ":campfire";

// External base URL (origin + path prefix) at which this gateway is reachable
// from a browser. Required when the gateway sits behind a reverse proxy with
// a path prefix — e.g. `https://example.com/oc/pokeball`. install.sh writes
// this to a sidecar file when CAMPFIRE_EXTERNAL_URL is set at install time.
// Falls back to constructing `http://<gateway-host>:<gateway-port>` when
// absent. Used by the `openclaw campfire url` CLI to print a URL the user
// can actually open.
const EXTERNAL_URL: string | null = (() => {
  const file = path.resolve(__dirname, "..", "external-url");
  try {
    const text = readFileSync(file, "utf-8").trim();
    return text || null;
  } catch {
    return null;
  }
})();

// Load the OpenUI Lang spec at module init. We FAIL LOUD if it's missing —
// openclaw-os silently degraded to an empty prompt, which would make every
// chat reply lose its UI rendering with no error message visible to the user.
const INLINE_UI_PROMPT: string = (() => {
  const file = path.resolve(__dirname, "..", "prompts", "openui-inline-ui.md");
  try {
    const text = readFileSync(file, "utf-8").trim();
    if (!text) throw new Error("prompt file is empty");
    return text;
  } catch (err) {
    throw new Error(
      `[campfire-plugin] Could not load OpenUI Lang prompt at ${file}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
})();

const CAMPFIRE_PREAMBLE = `# Campfire client — Generative UI is your default for visual/interactive answers

This chat is rendered by the **Campfire client**. The user wants answers as interactive UI — charts, tables, forms, dashboards — not walls of text. You produce UI with \`openui-lang\`, a small assignment-based DSL specific to this product. **Your training data does not contain openui-lang.** Do not guess its syntax from JSX, MDX, React, or any other component DSL — the authoritative spec is below.

## When to render plain text vs UI

**Plain text** — single-sentence factual answers, meta questions ("what can you do"), greetings. Match the weight of your answer to the weight of the question.

**Inline \`openui-lang\` block** — when ANY of these fire:
- Chart / graph / plot / trend / comparison / table / breakdown / visualization.
- Compare or rank 2+ things; series of numbers.
- Multi-field input → render a \`Form\` with \`FormControl\`s + a submit \`Button\`. Never a numbered list of questions.
- Answer would run past ~10 lines → wrap in \`SectionBlock([SectionItem(...)])\`.
- Suggesting next actions → end with \`FollowUpBlock([FollowUpItem(...)])\`.

The inline surface is **STATIC**: no \`Query\`, no \`Mutation\`, no \`$state\`. Need live data, refresh, or write actions? That's a durable **app** (\`app_create\`) — a different surface with extra components and a runtime. You **MUST \`read\` \`skills/openui-app/SKILL.md\` before calling \`app_create\` or \`app_update\`**; those tools reject the call until you have. Trigger phrases: "briefing", "morning briefing", "before standup", "daily digest", "dashboard", "command center", "war room", "monitor", "tracker", "control panel", "hub". Once the code is ready, **call \`app_create\` immediately** — don't finish narrating first.

Never explain that you *can* render UI — just render it.

## openui-lang — inline surface (authoritative spec)

${INLINE_UI_PROMPT}

## Cross-cutting rules

1. Inside \`MarkDownRenderer(...)\` text strings, NEVER include triple-backticks — they close the outer \`\`\`openui-lang fence early and the rest renders as raw markdown. (Inline-only concern; \`app_create\` takes raw code so the fence can't collide there.)

2. \`app_create\` / \`app_update\` validate the code and report \`validationErrors\` in the response — the app is saved either way. To fix them, call \`app_update\` with ONLY the corrected statements (typically 1–10 lines); the runtime merges by statement name. NEVER re-emit the whole program.

3. **App needs config you don't have?** (API keys, watchlist symbols, monthly burn, target repos, thresholds, timezone) — STOP, emit a \`Form\` inline to collect it, THEN \`app_create\`. Bake plain values into Query defaults or a config table; for secrets/API keys, have the user put them in \`~/.openclaw/workspace/.env\` and read them in the data script — never inline a key into app code. Skip the form only when the request is fully self-describing, or when the config is multi-row mutable state (that belongs in an in-app Form).

4. **"Every morning" / "Monday" / "daily" / "while I sleep" / "pre-fetched"** → propose a cron in the same response, don't wait to be asked. Same for heavy scripts (slow APIs, >50 paginated items, multi-source serial calls): wire cron → SQLite snapshot table → app reads from the DB. Live \`Query("exec")\` is fine for fast/light scripts.

## Refine flow

When the composer text starts with \`Refine app "..." (id: ...)\` or \`Refine artifact "..." (id: ...)\`, the user is iterating on an existing surface. For apps: \`read\` \`skills/openui-app/SKILL.md\` (if not already read this session), then \`app_update\` with that exact id (a 1–10 statement patch — never the whole program). For artifacts: \`update_markdown_artifact\` with that id. Do not create a new one.`;

// Build the lint payload that gets folded into app_create / app_update tool
// responses. Mirrors openclaw-os's pattern: agent always gets the saved id,
// AND structured findings + a correction nudge when the lint flagged issues.
// "Save anyway" is deliberate — rejecting outright forces full-rewrite
// retries, which is the failure mode that wrecked app quality in the prior
// project. Small \`app_update\` patches are the right loop.
function buildLintPayload(report: LintReport): Record<string, unknown> {
  if (report.ok) return {};
  const skillNudge =
    report.findings.length >= 5
      ? " If you haven't already, `read` `skills/openui-app/SKILL.md` before patching — most of these are catalog/syntax issues the skill covers."
      : "";
  return {
    validationErrors: report.findings,
    correction: `Your code has ${report.findings.length} validation issue(s). The app IS saved — read each finding's \`message\` and \`hint\`, then call \`app_update\` with ONLY the corrected statements (typically 1–10 lines). The runtime merges by statement name, so untouched lines stay put. NEVER re-emit the whole program.${skillNudge}`,
    ...(report.hint ? { hallucinationPrimer: report.hint } : {}),
  };
}

const APP_SKILL_GATE_MESSAGE =
  "Read `skills/openui-app/SKILL.md` first — it documents the openui-lang " +
  "*app* surface (Query, Mutation, $state, Stack, the full component catalog, " +
  "the lint loop). Reading it is required before `app_create` / `app_update`. " +
  "Then retry this call.";

export default definePluginEntry({
  id: "campfire-plugin",
  name: "Campfire",
  description:
    "Persistence + tools backing the Campfire web workspace. Injects the OpenUI Lang system prompt for Campfire-originating sessions.",
  configSchema: emptyPluginConfigSchema,

  register(api) {
    api.logger.info("[campfire-plugin] register() called — plugin loaded");

    // ── Stores (lazy-initialized on first use) ──────────────────────────────
    let appStore: AppStore | null = null;
    const getAppStore = (): AppStore => {
      if (!appStore) appStore = new AppStore(api.runtime.state.resolveStateDir());
      return appStore;
    };

    let artifactStore: ArtifactStore | null = null;
    const getArtifactStore = (): ArtifactStore => {
      if (!artifactStore) {
        artifactStore = new ArtifactStore(api.runtime.state.resolveStateDir());
      }
      return artifactStore;
    };

    // ── Prompt injection hook ────────────────────────────────────────────────
    api.on("before_prompt_build", (_event, ctx) => {
      if (!ctx.sessionKey?.endsWith(CAMPFIRE_SUFFIX)) return;
      return { prependSystemContext: CAMPFIRE_PREAMBLE };
    });

    // ── App-skill gate ───────────────────────────────────────────────────────
    // The app surface is much larger than the inline surface (Query, Mutation,
    // $state, lots of components, the lint loop). Without reading the skill
    // the agent guesses at this surface and quality collapses — that's the
    // single biggest reason app generation lagged behind openclaw-os in the
    // MVP build of campfire-plugin. This hook enforces: `app_create` and
    // `app_update` are blocked until the agent has `read`
    // `skills/openui-app/SKILL.md` in this session.
    //
    // Per-session memory is persisted to a JSON file so a gateway restart
    // doesn't force the agent to re-read on an ongoing conversation.
    let appSkillGate: { path: string; sessions: Set<string> } | null = null;
    const getAppSkillGate = (): { path: string; sessions: Set<string> } => {
      if (!appSkillGate) {
        const file = path.join(
          api.runtime.state.resolveStateDir(),
          "plugins",
          "campfire",
          "app-skill-read-sessions.json",
        );
        let sessions: Set<string>;
        try {
          const parsed: unknown = JSON.parse(readFileSync(file, "utf-8"));
          sessions = new Set(
            Array.isArray(parsed)
              ? parsed.filter((v): v is string => typeof v === "string")
              : [],
          );
        } catch {
          sessions = new Set();
        }
        appSkillGate = { path: file, sessions };
      }
      return appSkillGate;
    };
    const markAppSkillRead = (sessionKey: string): void => {
      const gate = getAppSkillGate();
      if (gate.sessions.has(sessionKey)) return;
      gate.sessions.add(sessionKey);
      try {
        mkdirSync(path.dirname(gate.path), { recursive: true });
        writeFileSync(gate.path, JSON.stringify([...gate.sessions], null, 2), "utf-8");
      } catch (err) {
        api.logger.warn(
          `[campfire-plugin] failed to persist app-skill gate: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    };

    api.on("before_tool_call", (event, ctx) => {
      const sessionKey = ctx.sessionKey;
      if (typeof sessionKey !== "string" || !sessionKey.endsWith(CAMPFIRE_SUFFIX)) {
        return;
      }

      // Mark the session as having read the skill when the agent reads it.
      if (event.toolName === "read") {
        const filePath = event.params["file_path"] ?? event.params["path"];
        if (
          typeof filePath === "string" &&
          filePath.replace(/\\/g, "/").includes("openui-app/SKILL.md")
        ) {
          markAppSkillRead(sessionKey);
        }
        return;
      }

      if (
        (event.toolName === "app_create" || event.toolName === "app_update") &&
        !getAppSkillGate().sessions.has(sessionKey)
      ) {
        api.logger.info(
          `[campfire-plugin] ${event.toolName} blocked — openui-app skill not read in session ${sessionKey}`,
        );
        return { block: true, blockReason: APP_SKILL_GATE_MESSAGE };
      }
      return;
    });

    // ── Tools for the agent ──────────────────────────────────────────────────

    api.registerTool(
      (ctx: OpenClawPluginToolContext) => ({
        name: "create_markdown_artifact",
        label: "Create Markdown Artifact",
        description:
          "Create a durable markdown document the user can view and revisit in the Artifacts panel. Use for reports, summaries, plans, or any structured text worth preserving.",
        parameters: {
          type: "object" as const,
          properties: {
            title: { type: "string", description: "Short, descriptive title" },
            content: { type: "string", description: "Full markdown content" },
          },
          required: ["title", "content"],
        },
        execute: async (_id: string, params: { title: string; content: string }) => {
          const artifact = await getArtifactStore().create({
            kind: "markdown",
            title: params.title,
            content: params.content,
            source: {
              agentId: ctx.agentId ?? "unknown",
              sessionKey: ctx.sessionKey ?? "unknown",
            },
          });
          return jsonResult({ id: artifact.id, title: artifact.title, createdAt: artifact.createdAt });
        },
      }),
      { name: "create_markdown_artifact" },
    );

    api.registerTool(
      () => ({
        name: "update_markdown_artifact",
        label: "Update Markdown Artifact",
        description:
          "Update the title and/or content of an existing markdown artifact by id. Call get_artifact first if you need to read the current content before editing.",
        parameters: {
          type: "object" as const,
          properties: {
            id: { type: "string", description: "The artifact id" },
            title: { type: "string", description: "New title (omit to keep current)" },
            content: { type: "string", description: "New markdown content (omit to keep)" },
          },
          required: ["id"],
        },
        execute: async (
          _id: string,
          params: { id: string; title?: string; content?: string },
        ) => {
          const artifact = await getArtifactStore().update(params.id, {
            ...(params.title !== undefined ? { title: params.title } : {}),
            ...(params.content !== undefined ? { content: params.content } : {}),
          });
          return jsonResult({ id: artifact.id, updatedAt: artifact.updatedAt });
        },
      }),
      { name: "update_markdown_artifact" },
    );

    api.registerTool(
      () => ({
        name: "get_artifact",
        label: "Get Artifact By Id",
        description: "Fetch the full content of an artifact by id.",
        parameters: {
          type: "object" as const,
          properties: { id: { type: "string", description: "The artifact id" } },
          required: ["id"],
        },
        execute: async (_id: string, params: { id: string }) => {
          const a = await getArtifactStore().get(params.id);
          if (!a) return jsonResult({ error: "Artifact not found", id: params.id });
          return jsonResult({ id: a.id, kind: a.kind, title: a.title, content: a.content });
        },
      }),
      { name: "get_artifact" },
    );

    api.registerTool(
      () => ({
        name: "list_artifacts",
        label: "List Artifacts",
        description: "List existing artifacts, optionally filtered by kind.",
        parameters: {
          type: "object" as const,
          properties: {
            kind: { type: "string", description: "Filter by kind (e.g. 'markdown'). Omit for all." },
          },
        },
        execute: async (_id: string, params: { kind?: string }) => {
          const items = await getArtifactStore().list(
            typeof params.kind === "string" ? params.kind : undefined,
          );
          return jsonResult(
            items.map((a) => ({
              id: a.id,
              kind: a.kind,
              title: a.title,
              createdAt: a.createdAt,
              updatedAt: a.updatedAt,
            })),
          );
        },
      }),
      { name: "list_artifacts" },
    );

    api.registerTool(
      (ctx: OpenClawPluginToolContext) => ({
        name: "app_create",
        label: "Create App",
        description:
          "Create a live interactive app. Pass complete openui-lang code. The app is stored and rendered in the Apps panel. Use for dashboards, trackers, command centers — anything durable the user will reopen.",
        parameters: {
          type: "object" as const,
          properties: {
            title: { type: "string", description: "Short display title" },
            code: { type: "string", description: "Complete openui-lang source code" },
          },
          required: ["title", "code"],
        },
        execute: async (_id: string, params: { title: string; code: string }) => {
          api.logger.info(
            `[campfire-plugin] app_create: title="${params.title}" code=${params.code.length} chars`,
          );
          const lint = lintOpenUICode(params.code);
          if (!lint.ok) {
            api.logger.info(
              `[campfire-plugin] app_create lint: ${lint.findings.length} finding(s) — ${lint.summary.slice(0, 180)}`,
            );
          }
          // Save unconditionally — surface lint findings back to the agent.
          // Rejecting outright forces full-rewrite retries; small app_update
          // patches are the right loop.
          const app = await getAppStore().create({
            title: params.title,
            content: params.code,
            agentId: ctx.agentId ?? "main",
            sessionKey: ctx.sessionKey ?? "",
          });
          return jsonResult({
            id: app.id,
            title: app.title,
            ...buildLintPayload(lint),
          });
        },
      }),
      { name: "app_create" },
    );

    api.registerTool(
      () => ({
        name: "get_app",
        label: "Get App",
        description: "Fetch an app's current openui-lang code by id. Call before app_update.",
        parameters: {
          type: "object" as const,
          properties: { id: { type: "string", description: "The app id" } },
          required: ["id"],
        },
        execute: async (_id: string, params: { id: string }) => {
          const app = await getAppStore().get(params.id);
          if (!app) return jsonResult({ error: "App not found", id: params.id });
          return jsonResult({ id: app.id, title: app.title, content: app.content });
        },
      }),
      { name: "get_app" },
    );

    api.registerTool(
      () => ({
        name: "app_update",
        label: "Update App",
        description:
          "Apply an incremental edit patch to an existing app. Pass ONLY changed/new openui-lang statements — the runtime merges by statement name into the saved program. Untouched statements stay put. Call get_app first to see the current code.",
        parameters: {
          type: "object" as const,
          properties: {
            id: { type: "string", description: "The app id" },
            patch: {
              type: "string",
              description:
                "openui-lang statements to merge (changed/new only — NOT the whole program)",
            },
            title: { type: "string", description: "Optional new title" },
          },
          required: ["id", "patch"],
        },
        execute: async (
          _id: string,
          params: { id: string; patch: string; title?: string },
        ) => {
          const existing = await getAppStore().get(params.id);
          if (!existing) return jsonResult({ error: "App not found", id: params.id });

          api.logger.info(
            `[campfire-plugin] app_update: id=${params.id} patch=${params.patch.length} chars`,
          );
          // Merge by statement name — agent sends only the statements that
          // changed; mergeStatements splices them into the saved program.
          const merged = mergeStatements(existing.content, params.patch);
          const lint = lintOpenUICode(merged);
          if (!lint.ok) {
            api.logger.info(
              `[campfire-plugin] app_update lint: ${lint.findings.length} finding(s) — ${lint.summary.slice(0, 180)}`,
            );
          }
          const updated = await getAppStore().update(params.id, {
            content: merged,
            ...(params.title !== undefined ? { title: params.title } : {}),
          });
          return jsonResult({
            id: updated.id,
            updatedAt: updated.updatedAt,
            ...buildLintPayload(lint),
          });
        },
      }),
      { name: "app_update" },
    );

    api.registerTool(
      () => ({
        name: "db_query",
        label: "Query App SQLite (read-only)",
        description:
          "Run a read-only SQL query against the per-session app database. Returns { rows: [...] }. Use named parameters for dynamic values.",
        parameters: {
          type: "object" as const,
          properties: {
            sql: { type: "string", description: "Read-only SQL." },
            params: {
              type: "object" as const,
              additionalProperties: true,
              description: "Optional named-parameter object, e.g. { id: 1 } for $id placeholder.",
            },
            namespace: {
              type: "string",
              description: "Optional logical DB name. Defaults to 'default'.",
            },
          },
          required: ["sql"],
        },
        execute: async (_id: string, args: Record<string, unknown>) =>
          jsonResult(
            await runDbQuery(api.runtime.state.resolveStateDir(), {
              sql: typeof args["sql"] === "string" ? args["sql"] : "",
              params: args["params"],
              namespace: args["namespace"],
            }),
          ),
      }),
      { name: "db_query" },
    );

    api.registerTool(
      () => ({
        name: "db_execute",
        label: "Write App SQLite",
        description:
          "Run a write or schema statement against the per-session app database. Returns { changes, lastInsertRowid }.",
        parameters: {
          type: "object" as const,
          properties: {
            sql: { type: "string", description: "SQL to execute (single statement when using params)." },
            params: { type: "object" as const, additionalProperties: true },
            namespace: { type: "string" },
          },
          required: ["sql"],
        },
        execute: async (_id: string, args: Record<string, unknown>) =>
          jsonResult(
            await runDbExecute(api.runtime.state.resolveStateDir(), {
              sql: typeof args["sql"] === "string" ? args["sql"] : "",
              params: args["params"],
              namespace: args["namespace"],
            }),
          ),
      }),
      { name: "db_execute" },
    );

    api.logger.info("[campfire-plugin] all tools registered");

    // ── Gateway RPC methods (consumed by the Campfire web client) ────────────

    api.registerGatewayMethod(
      "campfire.apps.list",
      async ({ respond }: GatewayRequestHandlerOptions) => {
        try {
          const apps = await getAppStore().list();
          respond(true, {
            apps: apps.map((a) => ({
              id: a.id,
              title: a.title,
              agentId: a.agentId,
              sessionKey: a.sessionKey,
              createdAt: a.createdAt,
              updatedAt: a.updatedAt,
            })),
          });
        } catch (e) {
          respond(false, undefined, {
            message: e instanceof Error ? e.message : "Failed to list apps",
            code: "apps.list_failed",
          });
        }
      },
    );

    api.registerGatewayMethod(
      "campfire.apps.get",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        try {
          const id = typeof params["id"] === "string" ? params["id"] : "";
          const app = await getAppStore().get(id);
          respond(true, { app });
        } catch (e) {
          respond(false, undefined, {
            message: e instanceof Error ? e.message : "Failed to get app",
            code: "apps.get_failed",
          });
        }
      },
    );

    api.registerGatewayMethod(
      "campfire.apps.delete",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        try {
          const id = typeof params["id"] === "string" ? params["id"] : "";
          await getAppStore().delete(id);
          respond(true, { deleted: id });
        } catch (e) {
          respond(false, undefined, {
            message: e instanceof Error ? e.message : "Failed to delete app",
            code: "apps.delete_failed",
          });
        }
      },
    );

    api.registerGatewayMethod(
      "campfire.artifacts.list",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        try {
          const kind = typeof params["kind"] === "string" ? params["kind"] : undefined;
          const items = await getArtifactStore().list(kind);
          respond(true, {
            artifacts: items.map((a) => ({
              id: a.id,
              kind: a.kind,
              title: a.title,
              source: {
                engineId: "campfire",
                agentId: a.source.agentId,
                sessionId: a.source.sessionKey,
              },
              createdAt: a.createdAt,
              updatedAt: a.updatedAt,
            })),
          });
        } catch (e) {
          respond(false, undefined, {
            message: e instanceof Error ? e.message : "Failed to list artifacts",
            code: "artifacts.list_failed",
          });
        }
      },
    );

    api.registerGatewayMethod(
      "campfire.artifacts.get",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        try {
          const id = typeof params["id"] === "string" ? params["id"] : "";
          const artifact = await getArtifactStore().get(id);
          respond(true, {
            artifact: artifact
              ? {
                  ...artifact,
                  source: {
                    engineId: "campfire",
                    agentId: artifact.source.agentId,
                    sessionId: artifact.source.sessionKey,
                  },
                }
              : null,
          });
        } catch (e) {
          respond(false, undefined, {
            message: e instanceof Error ? e.message : "Failed to get artifact",
            code: "artifacts.get_failed",
          });
        }
      },
    );

    api.registerGatewayMethod(
      "campfire.artifacts.delete",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        try {
          const id = typeof params["id"] === "string" ? params["id"] : "";
          await getArtifactStore().delete(id);
          respond(true, { deleted: id });
        } catch (e) {
          respond(false, undefined, {
            message: e instanceof Error ? e.message : "Failed to delete artifact",
            code: "artifacts.delete_failed",
          });
        }
      },
    );

    // ── tools.invoke — for rendered apps' Query/Mutation calls ───────────────
    // SAFETY: openclaw-os-plugin's equivalent shipped `exec` (arbitrary
    // `sh -c`) and `read` (arbitrary path). That was the worst defect in the
    // earlier review. Here we expose ONLY db_query and db_execute — both
    // scoped to per-session SQLite namespaces and (for db_query) further
    // confined by PRAGMA query_only=ON at the kernel level.
    //
    // If a future product need actually requires shell or file reads from
    // apps, that goes through a NEW explicit tool with an allowlist + UI
    // consent — not by widening this RPC.
    const APP_RUNTIME_TOOLS = new Set(["db_query", "db_execute"]);

    api.registerGatewayMethod(
      "campfire.tools.invoke",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        const toolName = typeof params["tool_name"] === "string" ? params["tool_name"] : "";
        const toolArgs =
          params["tool_args"] != null &&
          typeof params["tool_args"] === "object" &&
          !Array.isArray(params["tool_args"])
            ? (params["tool_args"] as Record<string, unknown>)
            : {};

        if (!toolName) {
          respond(false, undefined, {
            message: "tools.invoke requires a tool name",
            code: "tools.invoke_missing_tool",
          });
          return;
        }
        if (!APP_RUNTIME_TOOLS.has(toolName)) {
          respond(false, undefined, {
            message: `Tool "${toolName}" is not exposed to apps. Allowed: ${[...APP_RUNTIME_TOOLS].join(", ")}`,
            code: "tools.invoke_not_allowed",
          });
          return;
        }

        try {
          const stateDir = api.runtime.state.resolveStateDir();
          let result: unknown;
          if (toolName === "db_query") {
            result = await runDbQuery(stateDir, {
              sql: typeof toolArgs["sql"] === "string" ? toolArgs["sql"] : "",
              params: toolArgs["params"],
              namespace: toolArgs["namespace"],
            });
          } else {
            result = await runDbExecute(stateDir, {
              sql: typeof toolArgs["sql"] === "string" ? toolArgs["sql"] : "",
              params: toolArgs["params"],
              namespace: toolArgs["namespace"],
            });
          }
          respond(true, { result });
        } catch (e) {
          api.logger.error(
            `[campfire-plugin] tools.invoke failed: tool=${toolName} error=${
              e instanceof Error ? e.message : String(e)
            }`,
          );
          respond(false, undefined, {
            message: e instanceof Error ? e.message : "Tool invocation failed",
            code: "tools.invoke_failed",
          });
        }
      },
    );

    api.logger.info("[campfire-plugin] all gateway RPC methods registered");

    // ── Static UI route ─────────────────────────────────────────────────────
    // Serves the local-ui static export bundled into ../static/. The Campfire
    // workspace opens via this route, with the auth token passed in the URL
    // fragment (see CLI command below). All connections back to the gateway
    // go to the same origin so there's no CORS / cross-host concern.
    //
    // Path traversal guard uses `path.relative()` and checks the result does
    // not start with `..`. This is mechanically correct in a way the
    // `slice(0, -1)` startsWith trick openclaw-os-plugin used was not.
    const STATIC_ROOT = path.resolve(__dirname, "..", "static");
    const ROUTE_PREFIX = "/plugins/campfire";
    const MIME_TYPES: Record<string, string> = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".mjs": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".map": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".ico": "image/x-icon",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
      ".ttf": "font/ttf",
      ".txt": "text/plain; charset=utf-8",
    };

    const isInsideStaticRoot = (absPath: string): boolean => {
      const rel = path.relative(STATIC_ROOT, absPath);
      // path.relative returns "" when the paths are equal, a relative path
      // that does NOT start with `..` if inside, or one starting with `..`
      // (or an absolute path on Windows) if outside.
      return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
    };

    const serveFile = (res: ServerResponse, absPath: string): void => {
      const ext = path.extname(absPath).toLowerCase();
      const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": contentType,
        // HTML responses are small and the install-bound version can change
        // any time. Hashed assets under _next/static are immutable so we let
        // the browser cache them for a day.
        "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=86400",
      });
      createReadStream(absPath)
        .on("error", (err) => {
          api.logger.warn(`[campfire-plugin] static stream error ${absPath}: ${err}`);
          if (!res.headersSent) res.writeHead(500);
          res.end();
        })
        .pipe(res);
    };

    const tryServe = async (res: ServerResponse, candidate: string): Promise<boolean> => {
      if (!isInsideStaticRoot(candidate)) return false;
      try {
        const stats = await stat(candidate);
        if (stats.isFile()) {
          serveFile(res, candidate);
          return true;
        }
      } catch {
        // not present — try the next candidate
      }
      return false;
    };

    api.registerHttpRoute({
      path: ROUTE_PREFIX,
      auth: "plugin",
      match: "prefix",
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        const rawUrl = req.url ?? "/";
        const urlPath = rawUrl.split("?")[0]!.split("#")[0]!;
        let relPath = urlPath.startsWith(ROUTE_PREFIX)
          ? urlPath.slice(ROUTE_PREFIX.length)
          : urlPath;
        if (relPath === "" || relPath === "/") relPath = "/index.html";

        let safeRel: string;
        try {
          safeRel = decodeURIComponent(relPath);
        } catch {
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Bad Request");
          return true;
        }

        const absPath = path.resolve(STATIC_ROOT, "." + safeRel);

        // 1) direct file (e.g. /_next/static/<hash>.js, /favicon.svg)
        if (await tryServe(res, absPath)) return true;
        // 2) Next.js trailing-slash export: /setup/ → /setup/index.html
        if (await tryServe(res, path.join(absPath, "index.html"))) return true;
        // 3) /setup → setup.html (defensive — trailing-slash exports rarely need this)
        if (await tryServe(res, absPath + ".html")) return true;
        // 4) SPA fallback so client-side navigation links resolve
        if (await tryServe(res, path.join(STATIC_ROOT, "index.html"))) return true;

        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not Found");
        return true;
      },
    });

    const uiPort = api.config.gateway?.port ?? 18789;
    api.logger.info(
      `[campfire-plugin] workspace UI mounted at http://127.0.0.1:${uiPort}${ROUTE_PREFIX}/ (root ${STATIC_ROOT})`,
    );

    // ── CLI: openclaw campfire url ───────────────────────────────────────────
    // Mirrors openclaw-os's `openclaw os url` — prints a setup link with the
    // gateway auth token in the URL fragment, so the browser can pick it up
    // and stash it in IndexedDB without ever round-tripping through query
    // params (which would leak via Referer).
    api.registerCli(
      ({ program, config }) => {
        const group = program
          .command("campfire")
          .description("Campfire — local workspace served by this plugin");

        group
          .command("url")
          .description("Print the Campfire workspace URL with the auth token embedded")
          .action(() => {
            const port = config.gateway?.port ?? 18789;
            const bind = config.gateway?.bind;
            const customHost = config.gateway?.customBindHost;

            let host = "127.0.0.1";
            if (bind === "custom" && customHost) {
              host = customHost;
            } else if (bind === "tailnet") {
              process.stderr.write(
                "[campfire] gateway.bind=tailnet — using 127.0.0.1 in the URL. " +
                  "If the gateway isn't bound to loopback this link won't reach it.\n",
              );
            }

            const tokenInput = config.gateway?.auth?.token;
            if (typeof tokenInput !== "string" || !tokenInput) {
              const reason =
                tokenInput == null
                  ? "gateway.auth.token is missing"
                  : "gateway.auth.token is a SecretRef — resolve it first or set a plain string";
              throw new Error(`${reason}. Run \`openclaw onboard\` to set one.`);
            }

            const tk = encodeURIComponent(tokenInput);
            // If installed with CAMPFIRE_EXTERNAL_URL set (reverse-proxy
            // deployments), use that instead of the local host:port — the
            // user can't necessarily reach the gateway at 127.0.0.1.
            const base =
              EXTERNAL_URL?.replace(/\/+$/, "") ?? `http://${host}:${port}`;
            process.stdout.write(
              `${base}${ROUTE_PREFIX}/setup/#token=${tk}\n`,
            );
          });
      },
      { commands: ["campfire"] },
    );

    api.logger.info("[campfire-plugin] static UI route + CLI registered");
  },
});
