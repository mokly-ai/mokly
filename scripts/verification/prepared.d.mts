/** Output sets that prepared runners and package checks require. */
export type PreparedOutputKind = "all" | "package" | "example" | "unit";

/** Fail before a prepared runner starts when its preparation output is missing. */
export function requirePrepared(
  repositoryRoot: string,
  kind?: PreparedOutputKind,
): Promise<void>;
