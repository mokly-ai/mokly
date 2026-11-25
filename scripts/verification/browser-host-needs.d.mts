/** The only module that reads the copied static example of global setup. */
export const COPIED_HOST_MODULE: string;

/** Spec files whose static relative import graph reaches the copied host. */
export function copiedHostSpecs(
  repositoryRoot: string,
  specFiles: readonly string[],
): Promise<Set<string>>;
