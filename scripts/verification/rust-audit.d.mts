export type RustAuditCommand = (
  file: string,
  args: string[],
  options: { cwd: string },
) => Promise<{ stdout: string; stderr: string }>;

/** Return the pinned cargo-audit executable, built or reused for `root`. */
export type RustAuditInstaller = (root: string) => Promise<string>;

export interface RustAuditOptions {
  root: string;
  now?: () => Date;
  execute?: RustAuditCommand;
  install?: RustAuditInstaller;
  write?: (message: string) => void;
}

export function runRustAudit(options: RustAuditOptions): Promise<void>;
