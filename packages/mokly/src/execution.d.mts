export type Signal = "SIGINT" | "SIGTERM" | "SIGHUP" | "SIGBREAK";
export interface NativeChild {
  kill(signal: Signal): boolean;
  once(event: "error", listener: (error: Error) => void): unknown;
  once(event: "exit", listener: (status: number | null) => void): unknown;
}
export interface ExecutionDependencies {
  platform: string;
  spawn(
    binary: string,
    arguments_: string[],
    options: { stdio: "inherit" },
  ): NativeChild;
  subscribe(signal: Signal, handler: () => void): unknown;
  unsubscribe(signal: Signal, handler: () => void): unknown;
}
export function executeNative(
  binary: string,
  arguments_: string[],
  dependencies: ExecutionDependencies,
): Promise<number>;
