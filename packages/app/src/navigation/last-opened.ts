const key = "mokly.last-project";

/**
 * The project `/dashboard` reopens. It is the reader's own trail through the product,
 * kept on the device rather than guessed, and always re-checked against the
 * projects the API says they can open before it is followed.
 */
export function readLastProject(): string | undefined {
  try {
    return globalThis.localStorage?.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Remember the project the reader is in. */
export function writeLastProject(projectId: string): void {
  try {
    globalThis.localStorage?.setItem(key, projectId);
  } catch {
    return;
  }
}
