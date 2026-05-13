# @campfire/openclaw-plugin

The OpenClaw plugin that backs the [Campfire](../README.md) web workspace.

When you bind your local OpenClaw gateway in Campfire, this is what Campfire
needs running on your gateway. It exposes the tools the agent uses
(`app_create`, `create_markdown_artifact`, `db_query`, …) and the
`campfire.*` gateway RPCs the Campfire web client reads from.

Designed deliberately as a slimmer, safer counterpart to thesysdev's
[openclaw-os-plugin](https://github.com/thesysdev/openclaw-os/tree/main/packages/claw-plugin)
— same product idea, fewer attack surfaces:

| | openclaw-os-plugin | campfire-plugin |
| :--- | :--- | :--- |
| `db_query` read-only | syntactic prefix check (allows `PRAGMA writable_schema=1`) | `PRAGMA query_only=ON` at the connection (kernel-level) |
| Apps' `tools.invoke` | `exec` (`sh -c`), `read` (any path), `db_query`, `db_execute` | `db_query`, `db_execute` only |
| Static UI route path guard | `slice(0,-1).startsWith()` (off-by-one) | `path.relative()` + reject results starting with `..` |
| Install permission expansion | `tools.alsoAllow += group:plugins` automatically | not modified — user controls policy |
| Prompt loaded missing | silent empty string | hard-fails plugin load |
| Tests | 0 | DB safety + namespace sanitization |

## What it does

1. **Serves the workspace UI** at `http://<gateway>/plugins/campfire/`. The
   `local-ui/` Next.js app is statically exported and bundled into the
   plugin's `static/`. The gateway's own HTTP route serves it — no
   separate web server, no Postgres, no Docker.
2. **`openclaw campfire url`** prints a setup link with the gateway token
   in the URL fragment; the browser stashes it in IndexedDB.
3. **Registers tools for the agent**: `app_create`, `app_update`, `get_app`,
   `create_markdown_artifact`, `update_markdown_artifact`, `get_artifact`,
   `list_artifacts`, `db_query`, `db_execute`.
4. **Registers gateway RPCs for the Campfire client**: `campfire.apps.list /
   get / delete`, `campfire.artifacts.list / get / delete`,
   `campfire.tools.invoke`.
5. **Injects the OpenUI Lang system prompt** via a `before_prompt_build`
   hook, scoped to session keys ending with `:campfire`. Other clients on
   the same gateway (CLI, other plugins, …) are unaffected.

## Install

You need `openclaw` CLI ≥ 2026.4.12 and Node 22.5+. pnpm is auto-bootstrapped
by the installer if missing.

**One-liner** (macOS / Linux / WSL2):

```bash
curl -fsSL https://raw.githubusercontent.com/zhangqikevin/campfire/main/plugin/install.sh | bash
```

That pulls just the `plugin/` subdirectory from this repo, builds the
esbuild bundle, registers it with your local OpenClaw, restarts the
gateway, and verifies. Roughly 30 seconds, mostly `pnpm install`.

Uninstall:

```bash
curl -fsSL https://raw.githubusercontent.com/zhangqikevin/campfire/main/plugin/install.sh | bash -s -- uninstall
```

After installation, open the workspace:

```bash
openclaw campfire url
```

That prints a URL like `http://localhost:18789/plugins/campfire/setup/#token=…`.
Open it in a browser — token gets saved locally and you land in chat.

**Manual** (if you've cloned this repo already):

```bash
cd plugin
pnpm bundle-ui      # builds ../local-ui and copies out/ → ./static/
pnpm build          # esbuild bundles ./src/index.ts → ./dist/index.js
openclaw plugins install "$(pwd)" --force
openclaw gateway restart
```

Verify:

```bash
openclaw plugins list --json | jq '.[] | select(.id == "campfire-plugin")'
```

## Layout

```
plugin/
├── src/
│   ├── index.ts          Entrypoint — tools + RPCs + prompt hook + HTTP route + CLI
│   ├── app-store.ts      File-backed app storage (<state-dir>/plugins/campfire/apps/)
│   ├── artifact-store.ts File-backed artifact storage
│   └── db.ts             Per-session SQLite (query_only enforced)
├── prompts/
│   └── openui-inline-ui.md  OpenUI Lang spec, copied from openclaw-os (MIT)
├── static/               local-ui static export, populated by `pnpm bundle-ui`
├── tests/
│   └── db.test.ts        Verifies query_only blocks writes; namespace sanitization
├── openclaw.plugin.json  Plugin manifest
├── install.sh            One-liner installer
└── package.json
```

## What's still TODO (next slice)

- App version history + restore
- Notifications store + RPCs
- Uploads store + RPCs
- OpenUI Lang lint feedback in `app_create` / `app_update` responses
- App-skill gate (`before_tool_call` blocks `app_create` until the agent has
  read the app skill SKILL.md)
- Cron job listing (read-only viewer)

## License

MIT. Includes verbatim copies of OpenUI Lang prompt content from
thesysdev/openclaw-os (also MIT) — see `prompts/openui-inline-ui.md`.
