/** Refresh copied working-tree files so a warmup build cannot hide changes. */
export function refreshChangedSourceMtimes(cwd: string): Promise<string[]>;
