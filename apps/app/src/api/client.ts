import createClient from "openapi-fetch";

import { apiOrigin, appOrigin } from "../config";
import { decodeApiError, transportError } from "./errors";
import type { paths } from "./generated/schema";

/** A correlation identifier for one request, echoed by the API. */
export function requestId(): string {
  const source = globalThis.crypto;
  if (source && typeof source.randomUUID === "function") {
    return source.randomUUID();
  }
  const bytes = new Uint8Array(16);
  source?.getRandomValues?.(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

let csrfToken = "";

/** The session owns the CSRF token; every mutation reads it from here. */
export function setCsrfToken(token: string): void {
  csrfToken = token;
}

/**
 * The header parameters an authorized mutation declares. `Origin` is in the
 * contract because the API requires it, but the browser sets it itself and
 * ignores a page that tries to; only the CSRF token is ours to send.
 */
export function mutationHeaders(): {
  "X-CSRF-Token": string;
  Origin: string;
} {
  return { "X-CSRF-Token": csrfToken, Origin: appOrigin };
}

/** The header parameter the public authentication commands declare. */
export function originHeader(): { Origin: string } {
  return { Origin: appOrigin };
}

/** The correlation header every request carries, echoed by the API. */
export function correlationHeader(id: string): { "x-request-id": string } {
  return { "x-request-id": id };
}

/** The typed API client; the session cookie travels with every request. */
export const api = createClient<paths>({
  baseUrl: apiOrigin,
  credentials: "include",
});

interface Outcome<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** One call, given the correlation identifier it must send. */
export type Call<T> = (id: string) => Promise<Outcome<T>>;

/**
 * Turn one client call into the value it returned, or throw the typed failure
 * the screen branches on. The correlation identifier is generated here and
 * handed to the call, so the reference an error state shows is the one that
 * actually reached the API — including when nothing came back at all.
 */
export async function expectData<T>(call: Call<T>): Promise<T | undefined> {
  const correlation = requestId();
  let outcome: Outcome<T>;
  try {
    outcome = await call(correlation);
  } catch {
    throw transportError(correlation);
  }
  if (!outcome.response.ok) {
    throw decodeApiError(outcome.error, outcome.response, correlation);
  }
  return outcome.data;
}

/** The same call when the operation must answer with a body. */
export async function expectBody<T>(call: Call<T>): Promise<T> {
  const correlation = requestId();
  let outcome: Outcome<T>;
  try {
    outcome = await call(correlation);
  } catch {
    throw transportError(correlation);
  }
  if (!outcome.response.ok) {
    throw decodeApiError(outcome.error, outcome.response, correlation);
  }
  if (outcome.data === undefined) {
    throw transportError(correlation);
  }
  return outcome.data;
}
