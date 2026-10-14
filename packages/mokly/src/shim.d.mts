export interface NativePackage {
  version: string;
  binary: string;
}
export interface ShimRuntime {
  nodeVersion: string;
  platform: string;
  architecture: string;
  glibc: boolean;
  cliPackage(): { version: string };
  nativePackage(name: string): NativePackage;
  execute(binary: string, arguments_: string[]): Promise<number>;
}
export function runShim(
  arguments_: string[],
  runtime: ShimRuntime,
): Promise<number>;
