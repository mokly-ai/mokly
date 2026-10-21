export function requireUnpublishedRelease(
  root: string,
  execute?: (
    file: string,
    args: string[],
    options: { cwd: string },
  ) => Promise<{
    code: number | null;
    signal: string | null;
    stdout: string;
    stderr: string;
  }>,
): Promise<void>;
