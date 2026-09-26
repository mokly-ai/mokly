import crypto from "node:crypto";
import type http from "node:http";

import type { ExportOwnershipEntry } from "../../dist/export/ownership.js";
import type { UploadManifest } from "../../dist/publish/types.js";

import type { ValidatedFakePlan } from "./fake_receiver_validation.js";

/** Receiver route class used by override queues and request logs. */
export type FakeRequestKind = "plan" | "blob" | "complete" | "unknown";

/** One bounded scripted response returned before the normal route behavior. */
export interface FakeReceiverOverride {
  body?: string;
  retryAfter?: string;
  status: number;
  times?: number;
}

/** Credential-safe record of one request observed by the receiver. */
export interface FakeReceiverRequest {
  bodySize: number;
  headers: Readonly<Record<string, string>>;
  kind: FakeRequestKind;
  method: string;
  path: string;
  status: number;
}

/** Validated state retained for one successful plan request. */
export interface FakeReceiverPlan extends ValidatedFakePlan {
  archive: Buffer;
  expiresAt: string;
  id: string;
  missing: string[];
}

/** First publication retained for one commit and config path. */
export interface FakeReceiverPublication {
  body: Readonly<Record<string, string>>;
  manifest: UploadManifest;
}

/** Mutable timing controls used by expiry and concurrency tests. */
export interface FakeReceiverControl {
  blobDelayMs: number;
  defaultExpiryMs: number;
  expiryMs: number[];
}

/** Internal upload state extending the publicly inspectable plan. */
export interface FakeUpload extends FakeReceiverPlan {
  existing?: FakeReceiverPublication;
}

/** Remaining uses of one queued response override. */
export interface QueuedOverride extends FakeReceiverOverride {
  remaining: number;
}

/** Classify a request without deriving the configured plan endpoint. */
export function requestKind(
  method: string,
  path: string,
  endpoint: string,
): FakeRequestKind {
  if (method === "POST" && path === endpoint) return "plan";
  const pathname = new URL(path, "http://receiver.invalid").pathname;
  if (method === "PUT" && /^\/uploads\/[^/]+\/blobs\/[^/]+$/u.test(pathname))
    return "blob";
  if (method === "POST" && /^\/uploads\/[^/]+\/complete$/u.test(pathname))
    return "complete";
  return "unknown";
}

/** Canonicalize a configured endpoint to the exact request target. */
export function routePath(value: string): string {
  const url = new URL(value, "http://receiver.invalid");
  return `${url.pathname}${url.search}`;
}

/** Consume at most one use of the head response override. */
export function nextOverride(
  queue: QueuedOverride[] | undefined,
): QueuedOverride | undefined {
  const override = queue?.[0];
  if (!override) return;
  if (--override.remaining === 0) queue?.shift();
  return override;
}

/** Copy request headers while replacing the bearer credential. */
export function safeHeaders(
  headers: http.IncomingHttpHeaders,
): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (name === "authorization" || value === undefined) continue;
    safe[name] = Array.isArray(value) ? value.join(", ") : value;
  }
  if (headers.authorization) safe["authorization"] = "Bearer [redacted]";
  return safe;
}

/** Check the documented plan request headers and declared size. */
export function validPlanHeaders(
  headers: http.IncomingHttpHeaders,
  size: number,
): boolean {
  return (
    headers["content-type"] === "application/gzip" &&
    headers.accept === "application/json" &&
    headers["content-length"] === String(size)
  );
}

/** Check one blob request against its marker entry and exact bytes. */
export function validBlob(
  headers: http.IncomingHttpHeaders,
  entry: ExportOwnershipEntry,
  body: Buffer,
  digest: string,
): boolean {
  return (
    headers["content-type"] === "application/octet-stream" &&
    headers["content-length"] === String(entry.size) &&
    body.length === entry.size &&
    crypto.createHash("sha256").update(body).digest("hex") === digest
  );
}

/** Check the documented empty Complete request. */
export function validCompleteHeaders(
  headers: http.IncomingHttpHeaders,
  size: number,
): boolean {
  return (
    size === 0 &&
    headers.accept === "application/json" &&
    headers["content-length"] === "0"
  );
}

/** Return whether the receiver-side upload deadline has passed. */
export function expired(upload: FakeUpload): boolean {
  return Date.now() >= Date.parse(upload.expiresAt);
}

/** Build the keep-first identity within this fake receiver's project. */
export function publicationKey(manifest: UploadManifest): string {
  return `${manifest.headSha}\0${manifest.configPath}`;
}

/** Read the exact request bytes retained for validation and logging. */
export async function requestBytes(
  request: http.IncomingMessage,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/** Delay a scripted response to make concurrent requests observable. */
export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
