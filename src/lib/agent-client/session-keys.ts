// Session-key shape: `agent:<agentId>:<slot>:campfire`
// The `:campfire` suffix lets our plugin's `before_prompt_build` hook filter
// Campfire-originating sessions out of the rest of the OpenClaw session pool
// — only sessions with this suffix get the OpenUI Lang prompt injection.
// Other clients (CLI, scripts, openclaw-os-plugin sessions, …) sharing the
// same gateway are untouched.

export const CAMPFIRE_SUFFIX = ":campfire";

const MAIN_KEY_REGEX = /^agent:[^:]+:main:campfire$/i;
const AGENT_ID_KEY_REGEX = /^agent:([^:]+):[^:]+:campfire$/i;

export function encodeMain(agentId: string): string {
  return `agent:${agentId}:main${CAMPFIRE_SUFFIX}`;
}

export function encodeExtra(agentId: string, slotId: string = crypto.randomUUID()): string {
  return `agent:${agentId}:${slotId}${CAMPFIRE_SUFFIX}`;
}

export function hasCampfireSuffix(key: string): boolean {
  return key.endsWith(CAMPFIRE_SUFFIX);
}

export function isMainSession(key: string): boolean {
  return MAIN_KEY_REGEX.test(key.trim());
}

export function extractAgentIdFromKey(key: string): string | null {
  const match = key.trim().match(AGENT_ID_KEY_REGEX);
  return match?.[1] ?? null;
}
