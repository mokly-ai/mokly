/** Emit stable codes only; Electron messages and arbitrary fields can hold credentials. */
export function safeDiagnostic(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;
  return typeof code === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(code)
    ? `Desktop operation failed (${code})`
    : "Desktop operation failed";
}
