import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
/** Warn without changing the caller's ignore rules or destination. */
export async function warnUnignored(
  repository: string,
  root: string,
  run: (
    file: string,
    args: string[],
    options: { cwd: string },
  ) => Promise<unknown> = execute,
  warn: (message: string) => void = (message) => {
    process.stderr.write(message + "\n");
  },
) {
  try {
    await run("git", ["check-ignore", "--quiet", "--no-index", root], {
      cwd: repository,
    });
  } catch {
    warn(
      `Fixture directory is not confirmed ignored by Git: ${root}. Add it to your ignore rules before committing.`,
    );
  }
}
