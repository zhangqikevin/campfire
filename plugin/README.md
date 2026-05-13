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
| Static UI route | yes (path-traversal off-by-one) | none (UI lives at the Campfire web app, not on your gateway) |
| Install permission expansion | `tools.alsoAllow += group:plugins` automatically | not modified — user controls policy |
| Prompt loaded missing | silent empty string | hard-fails plugin load |
| Tests | 0 | DB safety + namespace sanitization |

## What it does

1. **Registers tools for the agent**: `app_create`, `app_update`, `get_app`,
   `create_markdown_artifact`, `update_markdown_artifact`, `get_artifact`,
   `list_artifacts`, `db_query`, `db_execute`.
2. **Registers gateway RPCs for the Campfire client**: `campfire.apps.list /
   get / delete`, `campfire.artifacts.list / get / delete`,
   `campfire.tools.invoke`.
3. **Injects the OpenUI Lang system prompt** via a `before_prompt_build`
   hook, scoped to session keys ending with `:campfire`. Other clients on
   the same gateway (CLI, other plugins, …) are unaffected.

## Install

You need `openclaw` CLI ≥ 2026.4.12, Node 22.5+, pnpm.

```bash
cd plugin
pnpm install
pnpm build

# From the repo root (where `openclaw` can see the directory):
openclaw plugins install ./plugin --force
openclaw gateway restart
```

To verify it's loaded:

```bash
openclaw plugins list --json | jq '.[] | select(.id == "campfire-plugin")'
```

You should see `status: "enabled"`.

Then in Campfire, bind this gateway and the Apps / Artifacts panels will
work.

## Layout

```
plugin/
├── src/
│   ├── index.ts          Entrypoint — tool & RPC registration + prompt hook
│   ├── app-store.ts      File-backed app storage (<state-dir>/plugins/campfire/apps/)
│   ├── artifact-store.ts File-backed artifact storage (similar layout)
│   └── db.ts             Per-session SQLite (query_only enforced)
├── prompts/
│   └── openui-inline-ui.md  OpenUI Lang spec, copied from openclaw-os (MIT)
├── tests/
│   └── db.test.ts        Verifies query_only blocks writes; namespace sanitization
├── openclaw.plugin.json  Plugin manifest
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
