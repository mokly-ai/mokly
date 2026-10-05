/** Typed source-protection causes shared by public and generated-file boundaries. */
export type SourceDenial = {
  kind: "entries" | "reserved" | "listed" | "generated";
};

/** Explain the matched rule without mistaking an exclusion for an authored input. */
export function sourceDenialMessage(denial: SourceDenial): string {
  switch (denial.kind) {
    case "entries":
      return "overlaps a source file matched by roots";
    case "reserved":
      return "uses a reserved source basename";
    case "listed":
      return "overlaps an authoring input listed in sourceFiles";
    case "generated":
      return "is inside the generated output directory";
  }
}
