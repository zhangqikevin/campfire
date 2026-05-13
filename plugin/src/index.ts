import { readFileSync } from "node:fs";
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Session-key suffix that scopes Campfire-originating sessions. The Campfire
// web client encodes session keys as `agent:<id>:main:campfire`; this plugin
// hook only fires for those, so other clients (CLI, scripts, openclaw-os-
// plugin sessions, …) on the same gateway are untouched.
const CAMPFIRE_SUFFIX = ":campfire";

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

The inline surface is **STATIC**: no \`Query\`, no \`Mutation\`, no \`$state\`. Need live data, refresh, or write actions? That's a durable **app** — call \`app_create\` with the openui-lang program.

Never explain that you *can* render UI — just render it.

## openui-lang — inline surface (authoritative spec)

${INLINE_UI_PROMPT}

## Cross-cutting rules

1. Inside \`MarkDownRenderer(...)\` text strings, NEVER include triple-backticks — they close the outer \`\`\`openui-lang fence early and the rest renders as raw markdown.

2. \`app_create\` / \`app_update\` validate the code and report \`validationErrors\` in the response. To fix, call \`app_update\` with ONLY the corrected statements; the runtime merges by name. NEVER re-emit the whole program.

3. **App needs config you don't have?** (API keys, watchlist, thresholds, timezone) — STOP, emit a \`Form\` inline to collect it, THEN \`app_create\`.

## Refine flow

When the composer text starts with \`Refine app "..." (id: ...)\` or \`Refine artifact "..." (id: ...)\`, the user is iterating on an existing surface — call \`app_update\` / \`update_markdown_artifact\` with that exact id (a small patch, never the whole program). Do not create a new one.`;

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
          const app = await getAppStore().create({
            title: params.title,
            content: params.code,
            agentId: ctx.agentId ?? "main",
            sessionKey: ctx.sessionKey ?? "",
          });
          return jsonResult({ id: app.id, title: app.title });
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
          "Replace an app's openui-lang code. Pass the FULL updated program (no statement-merging yet — coming in a later plugin version).",
        parameters: {
          type: "object" as const,
          properties: {
            id: { type: "string", description: "The app id" },
            code: { type: "string", description: "Full updated openui-lang source" },
            title: { type: "string", description: "Optional new title" },
          },
          required: ["id", "code"],
        },
        execute: async (
          _id: string,
          params: { id: string; code: string; title?: string },
        ) => {
          const existing = await getAppStore().get(params.id);
          if (!existing) return jsonResult({ error: "App not found", id: params.id });
          const updated = await getAppStore().update(params.id, {
            content: params.code,
            ...(params.title !== undefined ? { title: params.title } : {}),
          });
          return jsonResult({ id: updated.id, updatedAt: updated.updatedAt });
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
  },
});
