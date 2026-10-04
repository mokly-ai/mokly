/** Canonical browser-facing HTTP origins safe for Host and CSP source syntax. */

import { isIP } from "node:net";

/** Require an exact HTTP(S) origin with one DNS name or IP literal authority. */
export function isCanonicalHttpOrigin(value: string): boolean {
  try {
    const origin = new URL(value);
    return (
      (origin.protocol === "http:" || origin.protocol === "https:") &&
      origin.origin === value &&
      allowedHostname(origin.hostname)
    );
  } catch {
    return false;
  }
}

function allowedHostname(hostname: string): boolean {
  if (isIP(hostname) === 4) return true;
  if (hostname.startsWith("[") && hostname.endsWith("]"))
    return isIP(hostname.slice(1, -1)) === 6;
  if (hostname.length > 253) return false;
  return hostname
    .split(".")
    .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}
