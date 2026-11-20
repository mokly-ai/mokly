/** Absolute requests on Unix and Windows can reach the configured-file resolver. */
export const absoluteSpecifierPattern = /^(?:[\\/]|[a-zA-Z]:[\\/])/;

/** Match one TypeScript paths or package-export pattern without changing exact keys. */
export function substitution(
  pattern: string,
  name: string,
): string | undefined {
  const star = pattern.indexOf("*");
  if (star < 0) return pattern === name ? "" : undefined;
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  return name.startsWith(prefix) &&
    name.endsWith(suffix) &&
    name.length >= prefix.length + suffix.length
    ? name.slice(prefix.length, name.length - suffix.length)
    : undefined;
}

/** Fill target stars with literal matched text, leaving exact targets unchanged. */
export function substituteTarget(
  key: string,
  target: string,
  name: string,
  replacements: "all" | "first",
): string | undefined {
  const matched = substitution(key, name);
  if (matched === undefined) return undefined;
  if (!key.includes("*")) return target;
  return replacements === "all"
    ? target.replaceAll("*", () => matched)
    : target.replace("*", () => matched);
}
