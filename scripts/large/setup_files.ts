import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

/** Keep setup writes outside Serve's startup replay window without waiting. */
export async function settleFixtureFiles(root: string) {
  const child = spawn("git", ["ls-files", "-z"], {
    cwd: root,
    stdio: ["ignore", "pipe", "inherit"],
  });
  let spawnFailure: Error | undefined;
  child.once("error", (error) => {
    spawnFailure = error;
  });
  const closed = new Promise<void>((resolve) => {
    child.once("close", () => resolve());
  });
  child.stdout.setEncoding("utf8");
  const settled = new Date(Date.now() - 10_000);
  let pending = "";
  try {
    for await (const chunk of child.stdout) {
      if (typeof chunk !== "string")
        throw new Error("Git path output was not decoded as UTF-8");
      pending += chunk;
      let end;
      while ((end = pending.indexOf("\0")) >= 0) {
        const relative = pending.slice(0, end);
        pending = pending.slice(end + 1);
        if (!relative) continue;
        const file = path.join(root, relative);
        const metadata = await fs.lstat(file);
        if (metadata.isFile()) await fs.utimes(file, metadata.atime, settled);
      }
    }
    await closed;
    if (spawnFailure) throw spawnFailure;
    if (child.exitCode !== 0)
      throw new Error(
        `git ls-files exited with ${child.exitCode ?? child.signalCode}`,
      );
    if (pending) throw new Error("git ls-files returned an unterminated path");
  } finally {
    child.kill("SIGKILL");
    child.stdout.destroy();
    await closed;
  }
}
