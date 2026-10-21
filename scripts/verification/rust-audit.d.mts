export type RustAuditCommand = (
  file: string,
  args: string[],
  options: { cwd: string },
) => Promise<{ stdout: string; stderr: string }>;

export interface RustAuditOptions {
  root: string;
  now?: () => Date;
  execute?: RustAuditCommand;
  write?: (message: string) => void;
}

export function runRustAudit(options: RustAuditOptions): Promise<void>;
