/** One audit process; relative --prefix selects its cwd in both modes. */
export interface AuditCommand {
  file: string;
  args: string[];
  cwd: string;
  shell: boolean;
  env?: Readonly<Record<string, string | undefined>>;
}

/** Full output and process termination from the command boundary. */
export interface AuditCommandResult {
  exitCode: number | null;
  signal?: string | null;
  stdout: string;
  stderr: string;
}

/** npm executable configuration supplied by the composition root. */
export interface NpmAuditConfiguration {
  npmExecPath?: string | undefined;
  nodeExecPath: string;
  cwd: string;
  platform: string;
  env?: Readonly<Record<string, string | undefined>>;
}

/** Keep registry and authentication settings while selecting only this tree. */
export function auditCommandEnvironment(
  env: Readonly<Record<string, string | undefined>>,
  directory: string,
): Record<string, string | undefined>;

/** Use npm's current CLI through Node, including paths with spaces. */
export function npmAuditCommand(
  configuration: NpmAuditConfiguration,
): AuditCommand;

/** Relative --prefix keeps directory paths outside Windows shell arguments. */
export function auditCommandInDirectory(
  command: AuditCommand,
  directory: string,
): AuditCommand;

/** Execute an audit with bounded ownership of its output and process events. */
export function runAuditCommand(
  command: AuditCommand,
): Promise<AuditCommandResult>;
