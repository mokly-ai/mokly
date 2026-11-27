import {
  boundedJson,
  object,
  requestId,
  shape,
  textMatch,
} from "../probe/values.js";

const CHANNEL = "mokly-frame-access";
const VERSION = 1;
const BYTE_LIMIT = 8192;
const TOKEN = /^[A-Za-z0-9._~+/-]+=*$/;

export interface AccessToken {
  token: string;
  expiresAt: number;
}

export type AccessMessage =
  | { type: "request" | "reload" | "unavailable" }
  | ({ type: "token" } & AccessToken);

export function validAccessToken(value: unknown): value is AccessToken {
  return (
    typeof value === "object" &&
    value !== null &&
    "token" in value &&
    "expiresAt" in value &&
    textMatch(value.token, TOKEN, 4096) &&
    requestId(value.expiresAt)
  );
}

export function decodeAccessMessage(data: unknown): AccessMessage | undefined {
  const message = boundedJson(data, BYTE_LIMIT);
  if (
    !object(message) ||
    message.channel !== CHANNEL ||
    message.version !== VERSION
  )
    return;
  const { type } = message;
  if (type === "token" && shape(message, 5) && validAccessToken(message))
    return { type, token: message.token, expiresAt: message.expiresAt };
  if (
    (type === "request" || type === "reload" || type === "unavailable") &&
    shape(message, 3)
  )
    return { type };
}

export function encodeAccessMessage(message: AccessMessage): string {
  return JSON.stringify({ channel: CHANNEL, version: VERSION, ...message });
}
