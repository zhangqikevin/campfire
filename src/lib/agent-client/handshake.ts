import { signMessage, toBase64Url, type DeviceIdentity } from "./device-identity";
import {
  GATEWAY_CLIENT_CAPS,
  GATEWAY_CLIENT_IDS,
  GATEWAY_CLIENT_MODES,
  type ConnectParams,
} from "./types";

const PROTOCOL_VERSION = 3;
const CLIENT_ID = GATEWAY_CLIENT_IDS.CONTROL_UI;
const CLIENT_MODE = GATEWAY_CLIENT_MODES.UI;
const CLIENT_VERSION = "0.1.0";
const ROLE = "operator";
const SCOPES = ["operator.read", "operator.write", "operator.admin"];

/**
 * v3 signature payload format. Pipe-separated, deterministic ordering — must
 * match what the gateway re-computes from the connect params to verify the
 * signature. Field list / order is the wire contract; don't reorder.
 */
function buildV3Payload(
  deviceId: string,
  signedAtMs: number,
  token: string,
  nonce: string,
): string {
  return [
    "v3",
    deviceId,
    CLIENT_ID,
    CLIENT_MODE,
    ROLE,
    SCOPES.join(","),
    signedAtMs.toString(),
    token,
    nonce,
    "web",
    "",
  ].join("|");
}

export interface HandshakeAuth {
  token: string;
  deviceToken: string | null;
}

export async function buildConnectParams(
  nonce: string,
  auth: HandshakeAuth,
  device: DeviceIdentity,
): Promise<ConnectParams> {
  const signedAtMs = Date.now();
  // If we have a deviceToken (from a previous hello-ok), prefer it. Otherwise
  // fall back to the raw token the user pasted. Either way, the signature
  // payload binds the auth credential to this device's keypair + nonce.
  const credential = auth.deviceToken ?? auth.token;
  const payload = buildV3Payload(device.deviceId, signedAtMs, credential, nonce);
  const signature = await signMessage(payload, device.privateKey);

  return {
    minProtocol: PROTOCOL_VERSION,
    maxProtocol: PROTOCOL_VERSION,
    caps: [GATEWAY_CLIENT_CAPS.TOOL_EVENTS, GATEWAY_CLIENT_CAPS.THINKING_EVENTS],
    client: {
      id: CLIENT_ID,
      version: CLIENT_VERSION,
      platform: "web",
      mode: CLIENT_MODE,
    },
    role: ROLE,
    scopes: SCOPES,
    auth: auth.deviceToken ? { deviceToken: auth.deviceToken } : { token: auth.token },
    device: {
      id: device.deviceId,
      publicKey: toBase64Url(device.publicKey),
      signature: toBase64Url(signature),
      signedAt: signedAtMs,
      nonce,
    },
    locale: typeof navigator !== "undefined" ? navigator.language : "en-US",
    userAgent: `campfire/${CLIENT_VERSION}`,
  };
}
