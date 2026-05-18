// Build-time stub for local-ui only.
//
// The real `src/lib/agent-bindings/actions.ts` is a Next.js server-actions
// file with `"use server"`, which when imported pulls in drizzle / next-auth
// / bcryptjs — none of which exist in local-ui's dependency closure (and
// none of which make sense: local-ui has no DB and no auth).
//
// Local-ui only uses `getProvisionedToken` via ClientProvider, and even
// there the result is just a fallback when IDB is empty. In local mode the
// token comes from `#token=…` at `/setup/`, so the fallback is never the
// successful path. A no-op stub is the correct local-mode behaviour.
//
// local-ui/next.config.ts aliases `@/lib/agent-bindings/actions` to this
// file in the webpack pass. Do not import from this file directly.

export async function getProvisionedToken(
  _bindingId: string,
): Promise<{ ok: false; reason: "not_provisioned" }> {
  return { ok: false, reason: "not_provisioned" };
}
