/** Repository-path matching for declared mockup dependencies. */

/** Return whether a changed path is the dependency itself or its descendant. */
export function dependencyContainsChangedPath(
  dependency: string,
  changedPath: string,
): boolean {
  return changedPath === dependency || changedPath.startsWith(`${dependency}/`);
}
