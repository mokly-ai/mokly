import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);

/** Run npm with Node when its CLI path is available, including on Windows. */
export async function runNpm(
  args: readonly string[],
  options: { cwd: string; env?: Readonly<Record<string, string | undefined>> },
): Promise<{ stdout: string; stderr: string }> {
  const environment = options.env ?? process.env;
  const candidates = [
    environment.npm_execpath,
    path.resolve(
      path.dirname(process.execPath),
      "../lib/node_modules/npm/bin/npm-cli.js",
    ),
    path.resolve(
      path.dirname(process.execPath),
      "node_modules/npm/bin/npm-cli.js",
    ),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      await fs.access(candidate);
    } catch {
      continue;
    }
    return await execute(process.execPath, [candidate, ...args], {
      cwd: options.cwd,
      env: environment,
    });
  }
  return await execute("npm", args, { cwd: options.cwd, env: environment });
}
