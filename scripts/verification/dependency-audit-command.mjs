import { spawn } from "node:child_process";

const AUDIT_ARGUMENTS = [
  "audit",
  "--json",
  "--audit-level=low",
  "--package-lock-only",
  "--include=prod",
  "--include=dev",
  "--include=optional",
  "--include=peer",
  "--prefix",
  ".",
];
const SCOPE_CONFIGURATION =
  /^npm_config_(?:local_prefix|prefix|workspace|workspaces|global)$/iu;

/** Keep registry and authentication settings while selecting only this tree. */
export function auditCommandEnvironment(env, directory) {
  return {
    ...Object.fromEntries(
      Object.entries(env).filter(([key]) => !SCOPE_CONFIGURATION.test(key)),
    ),
    INIT_CWD: directory,
  };
}

/** Use npm's current CLI through Node, including paths with spaces. */
export function npmAuditCommand({
  npmExecPath,
  nodeExecPath,
  cwd,
  platform,
  env,
}) {
  return {
    file: npmExecPath ? nodeExecPath : "npm",
    args: npmExecPath
      ? [npmExecPath, ...AUDIT_ARGUMENTS]
      : [...AUDIT_ARGUMENTS],
    cwd,
    shell: !npmExecPath && platform === "win32",
    ...(env ? { env: auditCommandEnvironment(env, cwd) } : {}),
  };
}

/** Relative --prefix keeps directory paths outside Windows shell arguments. */
export function auditCommandInDirectory(command, directory) {
  return {
    ...command,
    cwd: directory,
    ...(command.env
      ? { env: auditCommandEnvironment(command.env, directory) }
      : {}),
  };
}

/** Execute an audit with bounded ownership of its output and process events. */
export function runAuditCommand(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(command.file, command.args, {
      cwd: command.cwd,
      shell: command.shell,
      env: auditCommandEnvironment(command.env ?? process.env, command.cwd),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (exitCode, signal) =>
      resolve({
        exitCode,
        signal,
        stdout: stdout.join(""),
        stderr: stderr.join(""),
      }),
    );
  });
}
