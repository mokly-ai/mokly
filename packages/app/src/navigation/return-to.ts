import { SITE_FIRST_SEGMENTS } from "../../../worker/src/site-segments";

import { dashboardPath, signInPath, signUpPath } from "./paths";

/** Where a rejected or absent return destination lands. */
export const defaultDestination = dashboardPath;

const credentialKeys = ["token", "secret", "code", "session"];
const encodedPathDelimiters = /%(?:2f|3f|23)/i;
const siteFirstSegments = new Set<string>([
  ...SITE_FIRST_SEGMENTS,
  ".well-known",
]);

function strictDecode(raw: string): string | undefined {
  try {
    return decodeURIComponent(raw);
  } catch {
    return undefined;
  }
}

function hasControl(value: string): boolean {
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (point < 0x20 || (point >= 0x7f && point <= 0x9f)) return true;
  }
  return false;
}

function pathAllowed(path: string): boolean {
  if (!path.startsWith("/") || path === "/") return false;
  if (
    hasControl(path) ||
    path.includes("\\") ||
    path.includes("%") ||
    path.includes("//") ||
    path.includes(":")
  ) {
    return false;
  }
  const segments = path.split("/");
  if (siteFirstSegments.has(segments[1] ?? "")) return false;
  return !segments.some((segment) => segment === "." || segment === "..");
}

function accountOrCallback(path: string): boolean {
  return (
    path === signInPath ||
    path.startsWith(signInPath + "/") ||
    path === signUpPath ||
    path.startsWith(signUpPath + "/") ||
    path === "/auth" ||
    path.startsWith("/auth/")
  );
}

function queryPartAllowed(
  raw: string,
  formEncoded: boolean,
): string | undefined {
  const decoded = strictDecode(formEncoded ? raw.replace(/\+/g, " ") : raw);
  if (decoded === undefined || hasControl(decoded)) return undefined;
  return decoded;
}

function queryAllowed(query: string): boolean {
  for (const pair of query.split("&")) {
    const separator = pair.indexOf("=");
    const rawKey = separator === -1 ? pair : pair.slice(0, separator);
    const rawValue = separator === -1 ? "" : pair.slice(separator + 1);
    const key = queryPartAllowed(rawKey, true);
    if (key === undefined || credentialKeys.includes(key.toLowerCase())) {
      return false;
    }
    if (queryPartAllowed(rawValue, false) === undefined) return false;
  }
  return true;
}

function canonicalValue(raw: string): string | undefined {
  if (raw.startsWith("/")) return raw;
  if (!/^%2f/i.test(raw)) return undefined;
  return strictDecode(raw);
}

/**
 * Read the return destination at the outer URL-query boundary exactly once.
 * Expo's router value is already decoded again on web, so the browser address
 * is the authority there; native and server rendering retain the router value.
 */
export function transportReturnTo(
  routerValue: string | null | undefined,
  browserSearch?: string,
): string | null | undefined {
  const locationSearch =
    typeof window === "undefined" ? undefined : window.location?.search;
  const search =
    locationSearch === undefined
      ? undefined
      : (browserSearch ?? locationSearch);
  return search === undefined
    ? routerValue
    : new URLSearchParams(search).get("returnTo");
}

/**
 * The only destination an authentication redirect may resume. Canonical input
 * has already passed through its outer transport, so its path and query bytes
 * stay intact: a literal fragment is stripped, and the path, the query keys
 * and the query values are decoded into copies for validation only. A wholly
 * encoded value that begins with `%2F` receives one compatibility decode. Everything unsafe
 * becomes the dashboard rather than an error, because a bad link should still
 * sign the reader in. The shared Rust fixture holds the accepted and rejected
 * cases.
 */
export function validateReturnTo(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.length === 0) return defaultDestination;
  const canonical = canonicalValue(raw);
  if (canonical === undefined || canonical.length === 0) {
    return defaultDestination;
  }
  const [beforeHash] = canonical.split("#", 1);
  const separator = beforeHash.indexOf("?");
  const rawPath =
    separator === -1 ? beforeHash : beforeHash.slice(0, separator);
  const query = separator === -1 ? "" : beforeHash.slice(separator + 1);
  const path = strictDecode(rawPath);
  if (
    encodedPathDelimiters.test(rawPath) ||
    path === undefined ||
    accountOrCallback(path) ||
    !pathAllowed(path) ||
    !queryAllowed(query)
  ) {
    return defaultDestination;
  }
  return beforeHash;
}

/** The current product address, normalized for a provider round trip. */
export function currentReturnTo(): string {
  if (typeof window === "undefined") return defaultDestination;
  return validateReturnTo(window.location.pathname + window.location.search);
}
