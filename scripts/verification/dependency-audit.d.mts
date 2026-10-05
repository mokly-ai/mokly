import type { AuditEvaluation } from "./dependency-audit-evaluation.mjs";

/** One cross-platform audit command; CLI arguments never require shell quoting. */
export interface AuditCommand {
  file: string;
  args: string[];
  cwd: string;
  shell: boolean;
}

/** Full output and process termination from the command boundary. */
export interface AuditCommandResult {
  exitCode: number | null;
  signal?: string | null;
  stdout: string;
  stderr: string;
}

/** Configuration from the composition root, separate from command execution. */
export interface NpmAuditConfiguration {
  npmExecPath?: string | undefined;
  nodeExecPath: string;
  cwd: string;
  platform: string;
}

/** All runtime collaborators required by the workspace audit gate. */
export interface AuditDependencies {
  command: AuditCommand;
  runCommand(command: AuditCommand): Promise<AuditCommandResult>;
  readFile(file: string): Promise<string>;
  clock(): Date;
  logger: {
    notice(message: string): void;
    error(message: string): void;
  };
}

/** Use npm's current CLI through Node, including on macOS and Windows. */
export function npmAuditCommand(
  configuration: NpmAuditConfiguration,
): AuditCommand;

/** Run the workspace gate through injected commands, file reads, time and logs. */
export function runDependencyAudit(
  dependencies: AuditDependencies,
): Promise<AuditEvaluation>;
