/** Sanitizing for developer-facing watched rebuild failure detail. */

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  REBUILD_DETAIL_BYTE_LIMIT,
  REBUILD_DETAIL_CHARACTER_LIMIT,
} from "@mokly/viewer/runtime";

const FALLBACK_DETAIL = "No additional details are available.";

/** Convert one caught value into bounded, repository-safe plain text. */
export function sanitizeRebuildFailure(
  error: unknown,
  repoRoot: string,
): string {
  const message = caughtMessage(error);
  const normalized = normalizeText(stripEscapeSequences(message));
  const rewritten =
    rewritePaths(normalized, repoRoot).trim() || FALLBACK_DETAIL;
  return boundDetail(rewritten);
}

function caughtMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return String(error);
  } catch {
    return "";
  }
}

function stripEscapeSequences(value: string): string {
  let result = "";
  for (let index = 0; index < value.length;) {
    const code = value.charCodeAt(index);
    if (code === 0x1b || code === 0x9b || code === 0x9d) {
      const consumed = escapeSequenceLength(value, index, code);
      if (consumed > 0) {
        index += consumed;
        continue;
      }
    }
    result += value[index];
    index += 1;
  }
  return result;
}

function escapeSequenceLength(
  value: string,
  start: number,
  code: number,
): number {
  const marker = code === 0x1b ? value.charCodeAt(start + 1) : code;
  const offset = code === 0x1b ? 2 : 1;
  if (marker === 0x5d || marker === 0x9d)
    return stringEscapeLength(value, start, offset);
  if (marker === 0x50 || marker === 0x58 || marker === 0x5e || marker === 0x5f)
    return stringEscapeLength(value, start, offset);
  if (marker === 0x5b || marker === 0x9b) {
    for (let index = start + offset; index < value.length; index++) {
      const current = value.charCodeAt(index);
      if (current >= 0x40 && current <= 0x7e) return index - start + 1;
    }
    return 0;
  }
  if (code !== 0x1b) return 0;
  let index = start + 1;
  while (index < value.length) {
    const current = value.charCodeAt(index);
    if (current >= 0x30 && current <= 0x7e) return index - start + 1;
    if (current < 0x20 || current > 0x2f) return 0;
    index += 1;
  }
  return 0;
}

function stringEscapeLength(
  value: string,
  start: number,
  offset: number,
): number {
  for (let index = start + offset; index < value.length; index++) {
    const current = value.charCodeAt(index);
    if (current === 0x07) return index - start + 1;
    if (current === 0x1b && value.charCodeAt(index + 1) === 0x5c)
      return index - start + 2;
  }
  return 0;
}

function normalizeText(value: string): string {
  const lineNormalized = value.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  let result = "";
  for (const scalar of lineNormalized) {
    const code = scalar.codePointAt(0) ?? 0;
    if (scalar === "\t") result += "  ";
    else if (scalar.length === 1 && code >= 0xd800 && code <= 0xdfff)
      result += "\uFFFD";
    else if (
      scalar === "\n" ||
      !(code <= 0x1f || (code >= 0x7f && code <= 0x9f))
    )
      result += scalar;
  }
  return result;
}

function rewritePaths(value: string, repoRoot: string): string {
  const quoted = value.replace(
    /(["'`])((?:file:\/{2,3}|[A-Za-z]:[\\/]|\\\\|\/)[^"'`\n]+)\1/g,
    (_match, quote: string, candidate: string) =>
      `${quote}${rewritePath(candidate, repoRoot)}${quote}`,
  );
  return quoted.replace(/\S+/g, (token) => rewritePathToken(token, repoRoot));
}

function rewritePathToken(token: string, repoRoot: string): string {
  const match =
    /^(?<prefix>[([<{"'`]*)(?<value>.*?)(?<suffix>[)\]}>"'`,;]*)$/.exec(token);
  if (!match?.groups) return token;
  const rewritten = rewritePath(match.groups["value"] ?? "", repoRoot);
  return `${match.groups["prefix"] ?? ""}${rewritten}${match.groups["suffix"] ?? ""}`;
}

function rewritePath(candidate: string, repoRoot: string): string {
  if (/^https?:\/\//i.test(candidate)) return candidate;
  const location = /(?<path>.*?)(?<location>:\d+(?::\d+)?)$/.exec(candidate);
  const source = location?.groups?.["path"] ?? candidate;
  const suffix = location?.groups?.["location"] ?? "";
  const absolute = absolutePath(source);
  if (!absolute) return candidate;
  const relative = repositoryRelative(absolute, repoRoot);
  return `${relative ?? "<absolute path>"}${suffix}`;
}

function absolutePath(
  value: string,
): { kind: "posix" | "windows"; value: string } | undefined {
  if (/^file:/i.test(value)) {
    try {
      const url = new URL(value);
      if (url.hostname && url.hostname !== "localhost")
        return {
          kind: "windows",
          value: `\\\\${url.hostname}${decodeURIComponent(
            url.pathname,
          ).replaceAll("/", "\\")}`,
        };
      if (/^\/[A-Za-z]:\//.test(url.pathname))
        return {
          kind: "windows",
          value: decodeURIComponent(url.pathname.slice(1)).replaceAll(
            "/",
            "\\",
          ),
        };
      return { kind: "posix", value: fileURLToPath(url) };
    } catch {
      return;
    }
  }
  if (/^(?:[A-Za-z]:[\\/]|\\\\)/.test(value)) return { kind: "windows", value };
  if (value.startsWith("/")) return { kind: "posix", value };
  return;
}

function repositoryRelative(
  candidate: { kind: "posix" | "windows"; value: string },
  repoRoot: string,
): string | undefined {
  const rootKind = /^(?:[A-Za-z]:[\\/]|\\\\)/.test(repoRoot)
    ? "windows"
    : "posix";
  if (candidate.kind !== rootKind) return;
  const paths = rootKind === "windows" ? path.win32 : path.posix;
  const root = paths.resolve(repoRoot);
  const absolute = paths.resolve(candidate.value);
  const relative = paths.relative(root, absolute);
  if (relative === "") return ".";
  if (
    relative === ".." ||
    relative.startsWith(`..${paths.sep}`) ||
    paths.isAbsolute(relative)
  )
    return;
  return relative.replaceAll("\\", "/");
}

function boundDetail(value: string): string {
  const scalars = [...value];
  if (
    scalars.length <= REBUILD_DETAIL_CHARACTER_LIMIT &&
    Buffer.byteLength(value) <= REBUILD_DETAIL_BYTE_LIMIT
  )
    return value;
  let result = "";
  let scalarCount = 0;
  let byteCount = 0;
  for (const scalar of scalars) {
    const scalarBytes = Buffer.byteLength(scalar);
    if (
      scalarCount + 1 > REBUILD_DETAIL_CHARACTER_LIMIT - 1 ||
      byteCount + scalarBytes > REBUILD_DETAIL_BYTE_LIMIT - 3
    )
      break;
    result += scalar;
    scalarCount += 1;
    byteCount += scalarBytes;
  }
  return `${result.trimEnd()}…`;
}
