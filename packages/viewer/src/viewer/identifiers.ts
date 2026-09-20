/** Validation grammar for a host-assigned viewer root identifier. */
const VIEWER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** Build the deterministic package-owned DOM prefix for one viewer root. */
export function viewerIdentifierPrefix(viewerId: string): string {
  if (typeof viewerId !== "string" || !VIEWER_ID_PATTERN.test(viewerId))
    throw new Error(
      "Invalid viewerId: expected 1-64 ASCII letters, digits, hyphens or underscores, starting with a letter or digit.",
    );
  return `mokly-${viewerId.length}-${viewerId}-`;
}
