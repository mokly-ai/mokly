/** Keep authored report text on one line without allowing Markdown markup. */
export function markdownText(value: string): string {
  return value
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/[\\`*_{}[\]()<>#+.!|~-]/g, "\\$&");
}

/** A code span whose delimiter cannot be closed by an authored value. */
export function markdownCode(value: string): string {
  const text = value.replace(/\s+/gu, " ").trim();
  const fence = "`".repeat(
    Math.max(0, ...[...text.matchAll(/`+/g)].map(([run]) => run.length)) + 1,
  );
  return text.includes("`")
    ? `${fence} ${text} ${fence}`
    : `${fence}${text}${fence}`;
}
