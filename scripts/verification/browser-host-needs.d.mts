/** Spec files whose static relative import graph reaches the copied host. */
export function copiedHostSpecs(
  repositoryRoot: string,
  specFiles: readonly string[],
): Promise<Set<string>>;
