# Campfire

A multi-tenant SaaS workspace for the agents you already run. You bring an OpenClaw gateway or a Hermes endpoint; Campfire gives you a chat UI that renders the agent's output as live, interactive components — charts, tables, dashboards — via [OpenUI Lang](https://openui.com).

Pairs with [`@campfire/openclaw-plugin`](./plugin/README.md) — the OpenClaw plugin that exposes the gateway-side tools and RPCs Campfire reads from. One-liner install for the plugin:

```bash
curl -fsSL https://raw.githubusercontent.com/zhangqikevin/campfire/main/plugin/install.sh | bash
```

## Architecture in one diagram

```
Browser (React + OpenUI renderer)
    │
    │  HTTPS/WS  ──→  Campfire backend (auth, persistence, lint)
    │                       Postgres: tenants, users, apps, artifacts, ...
    │
    └─ WS  ──→  User's bound agent (OpenClaw / Hermes)
                  └─ LLM + tool execution happens here, never on Campfire
```

The browser holds *both* connections. Campfire's servers never see the user's agent credentials in plaintext, and they never execute LLM-generated code. This is a deliberate response to the sandboxless `tools.invoke → sh -c` issue we saw in the precursor project.

## Non-negotiable rules

1. Campfire never executes user-generated code. Tool calls go to the user's agent.
2. Multi-tenancy lives in the schema (`tenant_id`), not in app-level filters.
3. Security boundaries use mechanism (kernel-level enforcement, `path.relative`, `PRAGMA query_only=ON`), not string-prefix heuristics.
4. External protocol types come from published packages, never hand-copied.
5. Security-critical code paths require unit tests; `--passWithNoTests` is banned in CI.
6. Permission changes are user-initiated, never silent.

## Stack

- **Next.js 15** (App Router, Server Actions, React 19)
- **Auth.js v5** with Credentials provider (email/password, JWT sessions)
- **Postgres** via Drizzle ORM
- **Tailwind CSS** for styling
- **Vitest** for unit tests
- **bcryptjs** for password hashing
- **Zod** for input validation

## Project layout

```
campfire/
├── src/
│   ├── app/                  Next.js App Router
│   │   ├── page.tsx          Landing
│   │   ├── (auth)/           Public auth pages (login, signup)
│   │   ├── (app)/            Auth-gated pages (dashboard, …)
│   │   └── api/auth/[...nextauth]/route.ts
│   ├── auth.ts               Auth.js full config (Node)
│   ├── auth.config.ts        Auth.js Edge-safe config (middleware)
│   ├── middleware.ts         Route protection
│   ├── components/
│   │   ├── auth/             SignupForm, LoginForm, LogoutButton
│   │   └── ui/               Button, Input, Label, FormError
│   └── lib/
│       ├── auth/             actions, password, schemas
│       ├── db/               Drizzle schema + client
│       └── env.ts            Zod-validated env loader
├── tests/                    Vitest unit tests
├── drizzle/                  Generated migrations (committed)
├── docker-compose.yml        Local Postgres
└── drizzle.config.ts
```

## Local setup

You need Node 20.18+ and Docker (for Postgres). pnpm recommended.

```bash
# 1. Install deps
pnpm install

# 2. Bring up Postgres
docker compose up -d postgres

# 3. Create your env file
cp .env.example .env
# Then fill in AUTH_SECRET — generate one with:
#   openssl rand -base64 32

# 4. Apply migrations
pnpm db:generate    # first time only, generates SQL from schema
pnpm db:migrate     # applies it

# 5. Run the dev server
pnpm dev
```

Open <http://localhost:3000>. Sign up with any email + a password of at least 8 characters. You'll land on the dashboard placeholder.

## Scripts

| Command | What it does |
| :--- | :--- |
| `pnpm dev` | Next.js dev server with HMR |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest, single run |
| `pnpm test:watch` | Vitest, watch mode |
| `pnpm db:generate` | Generate SQL migration from `schema.ts` |
| `pnpm db:migrate` | Apply migrations to the DB |
| `pnpm db:studio` | Drizzle Studio (browse the DB) |

## Roadmap (next slices, not yet built)

1. **Agent binding UI** — a settings page where the user pastes their OpenClaw `ws://` URL + token, or a Hermes endpoint. Stored as `agent_bindings` keyed by `tenant_id`. The browser opens the WebSocket; Campfire never holds plaintext credentials.
2. **Chat surface** — a per-agent thread with the user's bound agent. Messages stream to the browser; OpenUI Lang renders.
3. **Persistence layer** — `apps`, `artifacts`, `notifications`, `uploads` tables (all tenant-scoped). The persistence layer mirrors openclaw-os's model but with proper isolation and no in-tree `sh -c`.
4. **OpenUI lint** — server-side validation of agent-emitted OpenUI Lang against the published component schema, with findings returned as a `validationErrors` payload so the agent can self-correct.

## License

MIT.
