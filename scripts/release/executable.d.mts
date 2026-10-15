export function executable(
  file: string,
  args: string[],
  platform: string,
  node: string,
  npmPath?: string,
): { file: string; args: string[] };
