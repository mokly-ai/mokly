export const VERIFICATION_OWNER_ID_ENV: "MOKLY_VERIFICATION_OWNER_ID";
export const VERIFICATION_PROCESS_REGISTRY_ENV: "MOKLY_VERIFICATION_PROCESS_REGISTRY";
export const VERIFICATION_RESOURCE_ROOT_ENV: "MOKLY_VERIFICATION_RESOURCE_ROOT";

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
