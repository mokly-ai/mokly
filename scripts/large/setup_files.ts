import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Keep setup writes outside Serve's startup replay window without waiting. */
export async function settleFixtureFiles(root: string) {
  const { stdout } = await run("git", ["ls-files", "-z"], { cwd: root });
  const settled = new Date(Date.now() - 10_000);
  for (const relative of stdout.split("\0").filter(Boolean)) {
    const file = path.join(root, relative);
    const metadata = await fs.lstat(file);
    if (metadata.isFile()) await fs.utimes(file, metadata.atime, settled);
  }
}
