export function missingPreparedOutputs(
  repositoryRoot: string,
  options?: { browser?: boolean },
): Promise<string[]>;

export function requirePrepared(
  repositoryRoot: string,
  options?: { browser?: boolean },
): Promise<void>;
