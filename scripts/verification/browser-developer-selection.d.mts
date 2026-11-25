/**
 * The arguments of a developer browser run that select its tests, or
 * undefined when no spec filter narrows the run or another flag is present.
 */
export function browserSelectionArguments(
  args: readonly string[],
): string[] | undefined;

/** The list and import-graph boundaries of the copied example decision. */
export interface CopiedHostSelection {
  /** List the spec files that the filters select, as Playwright does. */
  list(filters: readonly string[]): Promise<readonly string[]>;
  /** Return the listed spec files that read the copied example. */
  readers(files: readonly string[]): Promise<ReadonlySet<string>>;
}

/** Whether a developer browser run with these arguments needs the copied example. */
export function selectionNeedsCopiedHost(
  args: readonly string[],
  selection: CopiedHostSelection,
): Promise<boolean>;
