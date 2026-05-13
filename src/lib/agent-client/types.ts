// Minimal subset of OpenClaw gateway protocol v3 types that Campfire's client
// actually uses. Source of truth lives at
//   https://github.com/openclaw/openclaw/blob/main/src/gateway/protocol/
// — we define our own narrow shapes here instead of importing because the
// upstream `openclaw` package doesn't publish these subpaths to npm, and a
// hand-copy of their full schema is a brittle long-term move (see Campfire
// principles file). Anything beyond what's listed here, add when we need it.

export const GATEWAY_CLIENT_IDS = {
  CONTROL_UI: "openclaw-control-ui",
} as const;

export const GATEWAY_CLIENT_MODES = {
  UI: "ui",
} as const;

export const GATEWAY_CLIENT_CAPS = {
  TOOL_EVENTS: "tool-events",
  THINKING_EVENTS: "thinking-events",
} as const;

export interface RequestFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

export interface GatewayErrorDetails {
  code?: string;
  reason?: string;
  requestId?: string;
  recommendedNextStep?: string;
}

export interface GatewayError {
  message?: string;
  details?: GatewayErrorDetails;
}

export interface ResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: string | GatewayError;
}

export interface EventFrame {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
}

export type GatewayFrame = RequestFrame | ResponseFrame | EventFrame;

export interface ConnectParams {
  minProtocol?: number;
  maxProtocol?: number;
  caps?: string[];
  client?: {
    id: string;
    version?: string;
    platform?: string;
    mode?: string;
  };
  role?: string;
  scopes?: string[];
  auth?: { token?: string; deviceToken?: string };
  device?: {
    id: string;
    publicKey: string;
    signature: string;
    signedAt: number;
    nonce: string;
  };
  locale?: string;
  userAgent?: string;
}

export interface HelloOk {
  protocol: number;
  auth?: { deviceToken?: string };
  features?: Record<string, unknown>;
}

export interface ChatUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  total?: number;
}

export interface ChatEvent {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
  usage?: ChatUsage;
  stopReason?: string;
}

export interface AssistantStreamData {
  delta: string;
}
export interface LifecycleStreamData {
  phase: "error" | "started" | "completed";
  error?: string;
}

interface AgentEventBase {
  runId: string;
  seq: number;
  ts: number;
  sessionKey?: string;
}
export interface AssistantAgentEvent extends AgentEventBase {
  stream: "assistant";
  data: AssistantStreamData;
}
export interface LifecycleAgentEvent extends AgentEventBase {
  stream: "lifecycle";
  data: LifecycleStreamData;
}
export interface OtherAgentEvent extends AgentEventBase {
  stream: string;
  data: Record<string, unknown>;
}
export type AgentEvent = AssistantAgentEvent | LifecycleAgentEvent | OtherAgentEvent;

export interface ChatHistoryMessage {
  id?: string;
  role?: string;
  content?: unknown;
}

export const ConnectionState = {
  DISCONNECTED: "DISCONNECTED",
  CONNECTING: "CONNECTING",
  CONNECTED: "CONNECTED",
  AUTH_FAILED: "AUTH_FAILED",
  PAIRING: "PAIRING",
  UNREACHABLE: "UNREACHABLE",
} as const;
export type ConnectionState = (typeof ConnectionState)[keyof typeof ConnectionState];
