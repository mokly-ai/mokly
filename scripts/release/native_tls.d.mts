export function assertNoCryptoLibrary(output: string): void;
export function inspectNativeTls(
  binary: string,
  os?: string,
  execute?: (
    file: string,
    args: string[],
  ) => Promise<{ stdout: string; stderr: string }>,
): Promise<string>;
