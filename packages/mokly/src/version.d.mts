export const SUPPORTED_NODE_RANGE: string;
export const TESTED_NODE_VERSIONS: readonly string[];
export function assertNodeVersion(version: string): void;
export function assertNativeVersion(
  expected: string,
  actual: string,
  name: string,
): void;
