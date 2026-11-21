/**
 * Compute the updates of one breaking release. `versions` names the released
 * versions, and `paths` keeps only those release components.
 */
export function releaseUpdates(
  root: string,
  changedFiles: string[],
  versions: Readonly<Record<string, string>>,
  paths?: readonly string[],
): Promise<Map<string, string>>;
