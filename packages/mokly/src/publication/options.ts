/** Explicit capability boundary for repository-owned static publication. */
export type PublicationOptions =
  | { includeChanges?: false; base?: never }
  | { includeChanges: true; base?: string };

/** Validate JavaScript callers before loading or capturing consumer content. */
export function publicationOptions(value: unknown = {}): PublicationOptions {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("publication options must be an object");
  const options = value as Record<string, unknown>;
  if (
    Object.keys(options).some(
      (key) => key !== "includeChanges" && key !== "base",
    ) ||
    (Object.hasOwn(options, "includeChanges") &&
      typeof options["includeChanges"] !== "boolean")
  )
    throw new Error("invalid publication options");
  if (options["includeChanges"] !== true) {
    if (Object.hasOwn(options, "base"))
      throw new Error("base requires includeChanges");
    return { includeChanges: false };
  }
  const base = options["base"];
  if (
    Object.hasOwn(options, "base") &&
    (typeof base !== "string" || base.trim() === "")
  )
    throw new Error("base must be a nonempty Git reference");
  return {
    includeChanges: true,
    ...(typeof base === "string" ? { base } : {}),
  };
}

/** Parse repository preview arguments independently of config evaluation. */
export function publicationArguments(args: readonly string[]): {
  options: PublicationOptions;
  output?: string;
} {
  const seen = new Set<string>();
  let includeChanges = false;
  let base: string | undefined;
  let output: string | undefined;
  const invalid = () =>
    new Error(
      "usage: node scripts/preview/build.mjs [--include-changes [--base <ref>]] [--out <path>]",
    );
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (!flag || seen.has(flag)) throw invalid();
    seen.add(flag);
    if (flag === "--include-changes") {
      includeChanges = true;
      continue;
    }
    if (flag !== "--base" && flag !== "--out") throw invalid();
    const value = args[++index];
    if (!value || value.startsWith("--") || value.trim() === "")
      throw invalid();
    if (flag === "--base") base = value;
    else output = value;
  }
  if (base !== undefined && !includeChanges) throw invalid();
  return {
    options: includeChanges
      ? { includeChanges, ...(base === undefined ? {} : { base }) }
      : {},
    ...(output === undefined ? {} : { output }),
  };
}
