export interface NativeTarget {
  target: string;
  triple: string;
  os: string;
  cpu: string;
  libc?: string;
  name: string;
  directory: string;
  executable: string;
}
export const NATIVE_TARGETS: readonly NativeTarget[];
export function nativeTarget(target: string): NativeTarget;
export function releasePackages(): {
  name: string;
  directory: string;
  artifact: string;
}[];
