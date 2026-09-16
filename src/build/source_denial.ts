/** Typed source-protection causes shared by public and generated-file boundaries. */
export type SourceDenial =
  | { kind: "entries" | "reserved" | "listed" }
  | { kind: "exclusion"; glob: string };

/** Explain the matched rule without mistaking an exclusion for an authored input. */
export function sourceDenialMessage(denial: SourceDenial): string {
  switch (denial.kind) {
    case "entries":
      return "overlaps authored source root (entriesDir)";
    case "reserved":
      return "uses a reserved source basename";
    case "listed":
      return "overlaps an authoring input listed in sourceFiles";
    case "exclusion":
      return `matches public exclusion ${JSON.stringify(denial.glob)} in publicExclude`;
  }
}
