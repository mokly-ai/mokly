/** Compute the updates of one breaking release; `fixedManifest` pins the versions. */
export function releaseUpdates(
  root: string,
  changedFiles: string[],
  fixedManifest?: Readonly<Record<string, string>>,
): Promise<Map<string, string>>;
