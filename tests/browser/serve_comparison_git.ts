import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

/** Commit private base sources through a temporary index, without a checkout. */
export async function commitBaseSources(
  root: string,
  files: Record<string, string | null>,
  parent: string,
) {
  await fs.mkdir(path.join(root, ".context"), { recursive: true });
  const temporary = await fs.mkdtemp(path.join(root, ".context", "base-"));
  const git = async (...args: string[]) =>
    (
      await exec("git", args, {
        cwd: root,
        env: { ...process.env, GIT_INDEX_FILE: path.join(temporary, "index") },
      })
    ).stdout.trim();
  try {
    const commit = await git(
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${parent}^{commit}`,
    );
    await git("read-tree", commit);
    for (const [name, contents] of Object.entries(files)) {
      if (contents === null) {
        await git("update-index", "--force-remove", "--", name);
      } else {
        const source = path.join(temporary, "source");
        await fs.writeFile(source, contents);
        const blob = await git(
          "hash-object",
          "-w",
          "--no-filters",
          "--",
          source,
        );
        await git("update-index", "--add", "--cacheinfo", "100644", blob, name);
      }
    }
    const tree = await git("write-tree");
    return await git(
      "commit-tree",
      tree,
      "-p",
      commit,
      "-m",
      "Fixture base sources",
    );
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
