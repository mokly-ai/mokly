import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { NodeBaselineExecutableResolver } from "../../dist/baseline/executable.js";

const execute = promisify(execFile);

/** Run npm without a shell, using the repository's Windows-safe resolver. */
export async function runNpm(
  args: readonly string[],
  options: {
    cwd: string;
    env?: Readonly<Record<string, string | undefined>>;
  },
): Promise<{ stdout: string; stderr: string }> {
  const env = Object.fromEntries(
    Object.entries(options.env ?? process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  const command = await new NodeBaselineExecutableResolver().resolve({
    argv: ["npm", ...args],
    cwd: options.cwd,
    env,
  });
  return await execute(command[0]!, command.slice(1), {
    cwd: options.cwd,
    env,
  });
}
