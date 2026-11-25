/**
 * The arguments of a developer browser run that select its tests, or
 * undefined when no spec filter narrows the run or another flag is present.
 */
export function browserSelectionArguments(
  args: readonly string[],
): string[] | undefined;
