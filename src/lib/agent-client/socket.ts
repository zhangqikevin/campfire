import { buildConnectParams, type HandshakeAuth } from "./handshake";
import type { DeviceIdentity } from "./device-identity";
import type { EventFrame, GatewayError, GatewayFrame, HelloOk } from "./types";

const AUTH_CLOSE_CODES = new Set([4001, 4003, 4401]);

const AUTH_FATAL_STEPS = new Set([
  "update_auth_configuration",
  "update_auth_credentials",
  "review_auth_configuration",
]);

const CHALLENGE_TIMEOUT_MS = 2000;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_MAX_ATTEMPTS = 6;

const log = (...args: unknown[]) => console.info("[campfire:socket]", ...args);
const warn = (...args: unknown[]) => console.warn("[campfire:socket]", ...args);

export interface GatewaySocketOptions {
  url: string;
  getAuth: () => HandshakeAuth;
  getDevice: () => Promise<DeviceIdentity>;
  onHelloOk: (hello: HelloOk) => void;
  onAuthFailed: () => void;
  onPairingRequired: (deviceId: string) => void;
  onEvent: (frame: EventFrame) => void;
  onStateChange: (connecting: boolean) => void;
  onUnreachable?: () => void;
}

export class GatewaySocket {
  private ws: WebSocket | null = null;
  private stopped = false;
  private pairingDetected = false;
  private reconnectDelay = RECONNECT_BASE_MS;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRpcs = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; method: string }
  >();
  private challengeResolve: ((nonce: string) => void) | null = null;
  private rpcCounter = 0;
  private _readyPromise: Promise<void> | null = null;
  private _readyResolve: (() => void) | null = null;
  private _readyReject: ((e: Error) => void) | null = null;

  constructor(private opts: GatewaySocketOptions) {}

  /** Resolves once the hello-ok handshake completes; rejects on disconnect. */
  get ready(): Promise<void> {
    if (!this._readyPromise) {
      this._readyPromise = new Promise<void>((resolve, reject) => {
        this._readyResolve = resolve;
        this._readyReject = reject;
      });
    }
    return this._readyPromise;
  }

  start(): void {
    this.stopped = false;
    this.reconnectAttempts = 0;
    this.reconnectDelay = RECONNECT_BASE_MS;
    this.scheduleConnect(0);
  }

  stop(): void {
    this.stopped = true;
    this.rejectReady(new Error("socket stopped"));
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeWs();
  }

  async request<T>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }
    const id = `rpc-${++this.rpcCounter}`;
    const frame: GatewayFrame = { type: "req", id, method, params };
    return new Promise<T>((resolve, reject) => {
      this.pendingRpcs.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        method,
      });
      this.ws!.send(JSON.stringify(frame));
    });
  }

  private scheduleConnect(delayMs: number): void {
    if (this.stopped) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delayMs);
  }

  private connect(): void {
    if (this.stopped) return;
    log(`connecting to ${this.opts.url}`);
    if (!this.pairingDetected) this.opts.onStateChange(true);

    try {
      this.ws = new WebSocket(this.opts.url);
    } catch (e) {
      warn("WebSocket constructor threw:", e);
      this.opts.onStateChange(false);
      this.opts.onUnreachable?.();
      return;
    }

    this.ws.onopen = () => this.handleOpen();
    this.ws.onmessage = (e) => this.handleMessage(e.data as string);
    this.ws.onclose = (e) => this.handleClose(e.code, e.reason);
    this.ws.onerror = () => {
      warn("ws onerror (close will follow)");
    };
  }

  private async handleOpen(): Promise<void> {
    const nonce = await this.waitForChallenge();
    if (this.stopped) return;

    let device: DeviceIdentity;
    try {
      device = await this.opts.getDevice();
    } catch (e) {
      warn("failed to get device identity:", e);
      this.closeWs();
      this.scheduleReconnect();
      return;
    }

    let hello: HelloOk;
    try {
      const params = await buildConnectParams(nonce, this.opts.getAuth(), device);
      hello = await this.request<HelloOk>("connect", params);
    } catch (e) {
      const error = this.parseError(e instanceof Error ? (e.cause ?? e.message) : e);
      if (this.isPairingRequired(error)) {
        this.pairingDetected = true;
        const displayId = error.details?.requestId ?? device.deviceId;
        this.opts.onPairingRequired(displayId);
        this.closeWs();
        this.scheduleReconnect();
        return;
      }
      if (this.isAuthFatal(error)) {
        this.opts.onAuthFailed();
        return;
      }
      this.closeWs();
      this.scheduleReconnect();
      return;
    }

    this.reconnectDelay = RECONNECT_BASE_MS;
    this.reconnectAttempts = 0;
    this.pairingDetected = false;
    this.opts.onHelloOk(hello);
    this.resolveReady();
  }

  private waitForChallenge(): Promise<string> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        warn("connect.challenge timeout — using random nonce");
        this.challengeResolve = null;
        resolve(crypto.randomUUID());
      }, CHALLENGE_TIMEOUT_MS);

      this.challengeResolve = (nonce) => {
        clearTimeout(timer);
        resolve(nonce);
      };
    });
  }

  private handleMessage(raw: string): void {
    let frame: GatewayFrame;
    try {
      frame = JSON.parse(raw) as GatewayFrame;
    } catch {
      warn("failed to parse frame:", raw.slice(0, 100));
      return;
    }

    if (frame.type === "event") {
      if (frame.event === "connect.challenge" && this.challengeResolve) {
        const payload = frame.payload as { nonce?: string } | undefined;
        this.challengeResolve(payload?.nonce ?? "");
        this.challengeResolve = null;
        return;
      }
      this.opts.onEvent(frame);
      return;
    }

    if (frame.type === "res") {
      const pending = this.pendingRpcs.get(frame.id);
      if (!pending) return;
      this.pendingRpcs.delete(frame.id);
      if (frame.ok) {
        pending.resolve(frame.payload);
      } else {
        const error = this.parseError(frame.error);
        const rejection = new Error(error.message ?? "RPC error");
        rejection.cause = error;
        pending.reject(rejection);
      }
    }
  }

  private handleClose(code: number, reason: string): void {
    this.rejectAllPending(new Error(`WebSocket closed: ${code} ${reason}`));
    this.rejectReady(new Error(`WebSocket closed: ${code} ${reason}`));
    this.challengeResolve = null;
    if (this.stopped) return;

    if (this.pairingDetected) return;

    if (AUTH_CLOSE_CODES.has(code)) {
      this.opts.onAuthFailed();
      return;
    }
    this.scheduleReconnect();
  }

  private parseError(raw: unknown): GatewayError {
    if (typeof raw === "string") return { message: raw };
    if (typeof raw === "object" && raw !== null) return raw as GatewayError;
    return { message: String(raw) };
  }

  private isPairingRequired(error: GatewayError): boolean {
    const raw = error as Record<string, unknown>;
    if (raw["code"] === "NOT_PAIRED") return true;
    if (error.details?.code === "PAIRING_REQUIRED") return true;
    if (error.message === "pairing required") return true;
    return false;
  }

  private isAuthFatal(error: GatewayError): boolean {
    const step = error.details?.recommendedNextStep;
    if (step) return AUTH_FATAL_STEPS.has(step);
    const code = error.details?.code ?? "";
    return code.startsWith("AUTH_") || code.startsWith("DEVICE_AUTH_");
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    this.reconnectAttempts += 1;
    if (this.reconnectAttempts > RECONNECT_MAX_ATTEMPTS) {
      this.opts.onStateChange(false);
      this.opts.onUnreachable?.();
      return;
    }
    if (!this.pairingDetected) this.opts.onStateChange(true);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
  }

  private closeWs(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  private resolveReady(): void {
    this._readyResolve?.();
    this._readyResolve = null;
    this._readyReject = null;
  }

  private rejectReady(err: Error): void {
    this._readyReject?.(err);
    this._readyPromise = null;
    this._readyResolve = null;
    this._readyReject = null;
  }

  private rejectAllPending(err: Error): void {
    for (const pending of this.pendingRpcs.values()) {
      pending.reject(err);
    }
    this.pendingRpcs.clear();
  }
}
