/** Strict bounded decoding for browser render diagnostics. */

import type { IncomingMessage } from "node:http";

import { isEntryPath } from "@mokly/viewer/data";

import type { InteractiveRenderDiagnostic } from "./runtime/diagnostics.js";

export const INTERACTIVE_DIAGNOSTIC_BODY_LIMIT = 16_384;
const MESSAGE_LIMIT = 2_048;

/** Typed request failures owned by the diagnostics HTTP boundary. */
export enum InteractiveDiagnosticInputError {
  Invalid = "invalid",
  TooLarge = "too-large",
}

/** Decoding failure with a stable reason for HTTP status mapping. */
export class InteractiveDiagnosticRequestError extends Error {
  constructor(readonly code: InteractiveDiagnosticInputError) {
    super(`Invalid Live diagnostic: ${code}`);
    this.name = "InteractiveDiagnosticRequestError";
  }
}

/** Read one complete JSON body without permitting an unbounded allocation. */
export async function readInteractiveDiagnostic(
  request: IncomingMessage,
): Promise<InteractiveRenderDiagnostic> {
  const declared = Number(request.headers["content-length"] ?? 0);
  if (
    (Number.isFinite(declared) &&
      declared > INTERACTIVE_DIAGNOSTIC_BODY_LIMIT) ||
    declared < 0
  ) {
    request.resume();
    throw new InteractiveDiagnosticRequestError(
      InteractiveDiagnosticInputError.TooLarge,
    );
  }
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const data of request) {
    const chunk = Buffer.from(data as Uint8Array);
    length += chunk.byteLength;
    if (length > INTERACTIVE_DIAGNOSTIC_BODY_LIMIT)
      throw new InteractiveDiagnosticRequestError(
        InteractiveDiagnosticInputError.TooLarge,
      );
    chunks.push(chunk);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new InteractiveDiagnosticRequestError(
      InteractiveDiagnosticInputError.Invalid,
    );
  }
  if (!record(value) || !validMessage(value["message"]))
    throw new InteractiveDiagnosticRequestError(
      InteractiveDiagnosticInputError.Invalid,
    );
  const minimal = ["code", "message"];
  if (exact(value, minimal) && value["code"] === "render-error")
    return { code: "render-error", message: value["message"] };
  const variantPath = value["variantPath"];
  const keys = [
    "code",
    "colorScheme",
    "entryPath",
    "entryKind",
    "message",
    ...(variantPath === undefined ? [] : ["variantPath"]),
    "viewport",
  ];
  if (
    !exact(value, keys) ||
    value["code"] !== "render-error" ||
    (value["colorScheme"] !== "light" && value["colorScheme"] !== "dark") ||
    !isEntryPath(value["entryPath"]) ||
    (value["entryKind"] !== "screen" && value["entryKind"] !== "component") ||
    (value["viewport"] !== "mobile" && value["viewport"] !== "desktop") ||
    (variantPath !== undefined && !isEntryPath(variantPath)) ||
    (value["entryKind"] === "component") !== (variantPath !== undefined)
  )
    throw new InteractiveDiagnosticRequestError(
      InteractiveDiagnosticInputError.Invalid,
    );
  return value as unknown as InteractiveRenderDiagnostic;
}

/** Stable once-per-view key; pre-bootstrap failures share one unknown view. */
export function interactiveDiagnosticViewKey(
  diagnostic: InteractiveRenderDiagnostic,
): string {
  return diagnostic.entryPath
    ? [
        diagnostic.entryPath,
        diagnostic.variantPath ?? "",
        diagnostic.viewport,
        diagnostic.colorScheme,
      ].join("\0")
    : "<unknown>";
}

/** Keep the terminal diagnostic on one bounded line. */
export function interactiveDiagnosticLine(
  generation: string,
  diagnostic: InteractiveRenderDiagnostic,
): string {
  const view = diagnostic.entryPath
    ? `${diagnostic.entryPath}${diagnostic.variantPath ? `/${diagnostic.variantPath}` : ""} ${diagnostic.viewport}/${diagnostic.colorScheme}`
    : "unknown view";
  const message = diagnostic.message.replace(/\s+/g, " ").trim();
  return `[mokly/render-error] ${generation} ${view}: ${message}`;
}

function exact(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validMessage(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MESSAGE_LIMIT &&
    Buffer.byteLength(value) <= MESSAGE_LIMIT * 4
  );
}
