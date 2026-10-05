/** One whole-tree Git change, with a predecessor for detected renames. */
export interface GitFileChange {
  status: string;
  path: string;
  source?: string;
}

/** Read-only comparison, working-tree, and release-tag access. */
export class GitWorkspace {
  constructor(root: string, target?: string);
  requireBase(): string;
  changedFiles(roots: readonly string[]): GitFileChange[];
  currentFiles(roots: readonly string[]): string[];
  baseFiles(root: string): string[];
  readBase(path: string): Buffer;
  baseFileExists(path: string): boolean;
  newestReachableTag(pattern: string): string | undefined;
  readRevision(revision: string, path: string): Buffer;
  revisionFileExists(revision: string, path: string): boolean;
}
