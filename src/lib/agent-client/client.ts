import {
  clearDeviceToken,
  getOrCreateDeviceIdentity,
  saveDeviceToken,
  type DeviceIdentity,
} from "./device-identity";
import { GatewaySocket } from "./socket";
import {
  ConnectionState,
  type ChatHistoryMessage,
  type EventFrame,
  type HelloOk,
} from "./types";

export interface ClientConfig {
  bindingId: string;
  url: string;
  /** Raw user-supplied token from IndexedDB. */
  token: string;
}

export type ConnectionStateListener = (state: ConnectionState) => void;
export type EventListener = (frame: EventFrame) => void;

export interface AgentInfo {
  id: string;
  identity?: { name?: string; emoji?: string };
}

export class Client {
  readonly bindingId: string;
  readonly url: string;

  private socket: GatewaySocket | null = null;
  private device: DeviceIdentity | null = null;
  private token: string;
  private deviceToken: string | null = null;
  private _state: ConnectionState = ConnectionState.DISCONNECTED;
  private stateListeners = new Set<ConnectionStateListener>();
  private eventListeners = new Set<EventListener>();

  constructor(config: ClientConfig) {
    this.bindingId = config.bindingId;
    this.url = config.url;
    this.token = config.token;
  }

  get state(): ConnectionState {
    return this._state;
  }

  onStateChange(listener: ConnectionStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this._state);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  private setState(next: ConnectionState): void {
    if (next === this._state) return;
    this._state = next;
    for (const listener of this.stateListeners) listener(next);
  }

  private emitEvent(frame: EventFrame): void {
    for (const listener of this.eventListeners) listener(frame);
  }

  async connect(): Promise<void> {
    if (this.socket) return;

    // Lazy-load device identity (per-binding ed25519 keys from IndexedDB).
    this.device = await getOrCreateDeviceIdentity(this.bindingId);
    this.deviceToken = this.device.deviceToken;

    this.socket = new GatewaySocket({
      url: this.url,
      getAuth: () => ({ token: this.token, deviceToken: this.deviceToken }),
      getDevice: async () => this.device!,
      onHelloOk: (hello: HelloOk) => {
        this.setState(ConnectionState.CONNECTED);
        const newDeviceToken = hello.auth?.deviceToken;
        if (newDeviceToken && newDeviceToken !== this.deviceToken) {
          this.deviceToken = newDeviceToken;
          void saveDeviceToken(this.bindingId, newDeviceToken);
        }
      },
      onAuthFailed: () => {
        // If we tried deviceToken first, clear it and let the next cycle fall
        // back to the raw token. If we already had only raw token, fail loud.
        if (this.deviceToken) {
          this.deviceToken = null;
          void clearDeviceToken(this.bindingId);
        } else {
          this.setState(ConnectionState.AUTH_FAILED);
        }
      },
      onPairingRequired: () => {
        this.setState(ConnectionState.PAIRING);
      },
      onEvent: (frame) => this.emitEvent(frame),
      onStateChange: (connecting) => {
        if (this._state === ConnectionState.UNREACHABLE && !connecting) return;
        if (this._state === ConnectionState.CONNECTED) return;
        this.setState(connecting ? ConnectionState.CONNECTING : ConnectionState.DISCONNECTED);
      },
      onUnreachable: () => {
        this.setState(ConnectionState.UNREACHABLE);
      },
    });
    this.socket.start();
  }

  disconnect(): void {
    this.socket?.stop();
    this.socket = null;
    this.setState(ConnectionState.DISCONNECTED);
  }

  async request<T>(method: string, params?: unknown): Promise<T> {
    if (!this.socket) throw new Error("Client not connected");
    return this.socket.request<T>(method, params);
  }

  // ── Chat helpers ────────────────────────────────────────────────────────

  async sendChat(
    sessionKey: string,
    message: string,
    options?: { idempotencyKey?: string },
  ): Promise<void> {
    await this.request("chat.send", {
      sessionKey,
      message,
      idempotencyKey: options?.idempotencyKey ?? crypto.randomUUID(),
      // deliver:false → run continues server-side regardless of this client's
      // subscription. Mirrors openclaw-os's fire-and-forget pattern; we listen
      // for the run's events on the bus instead of a direct response stream.
      deliver: false,
    });
  }

  async abortChat(sessionKey: string): Promise<void> {
    try {
      await this.request("chat.abort", { sessionKey });
    } catch {
      // best-effort
    }
  }

  async loadHistory(sessionKey: string, limit = 200): Promise<ChatHistoryMessage[]> {
    const result = await this.request<{ messages?: ChatHistoryMessage[] }>("chat.history", {
      sessionKey,
      limit,
    });
    return result?.messages ?? [];
  }

  async listAgents(): Promise<AgentInfo[]> {
    try {
      const result = await this.request<{ agents?: AgentInfo[] }>("agents.list");
      return result?.agents ?? [];
    } catch {
      return [];
    }
  }
}
