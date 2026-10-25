export interface VerificationProcessOwner {
  environment(
    base?: Readonly<Record<string, string | undefined>>,
  ): NodeJS.ProcessEnv;
  terminate(signal: NodeJS.Signals): Promise<void>;
  dispose(): Promise<void>;
}

export function createVerificationProcessOwner(options?: {
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
}): Promise<VerificationProcessOwner>;
