import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";

import { createFixture, removeFixture } from "./fixture.js";

const execute = promisify(execFile);

/** Independent consumer with a committed baseline and unignored export target. */
export async function createExportFixture(
  source?: string,
  options?: { extraConfig?: string; gitObjectFormat?: "sha256" },
) {
  const fixture = await createFixture(source, options);
  try {
    const config = await loadConfig(fixture.root);
    await writeCompilation(await compileCatalogue(config), config);
    const git = (...args: string[]) =>
      execute("git", args, { cwd: fixture.root });
    await git(
      "init",
      "-q",
      ...(options?.gitObjectFormat ? ["--object-format=sha256"] : []),
    );
    if (options?.gitObjectFormat)
      await writeCompilation(await compileCatalogue(config), config);
    await git("config", "user.email", "test@example.invalid");
    await git("config", "user.name", "Test");
    await git("add", ".");
    await git("commit", "-qm", "test: export baseline");
    await git("update-ref", "refs/remotes/origin/main", "HEAD");
    return {
      ...fixture,
      config,
      git,
      output: path.join(fixture.root, "site"),
      close: () => removeFixture(fixture),
    };
  } catch (error) {
    await removeFixture(fixture);
    throw error;
  }
}

/** Read every regular file without depending on provider-specific serving. */
export async function directoryFiles(root: string, prefix = "") {
  const files = new Map<string, Buffer>();
  for (const entry of await fs.promises.readdir(root, {
    withFileTypes: true,
  })) {
    const relative = `${prefix}${entry.name}`;
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) {
      for (const [name, bytes] of await directoryFiles(
        candidate,
        `${relative}/`,
      ))
        files.set(name, bytes);
    } else files.set(relative, await fs.promises.readFile(candidate));
  }
  return files;
}
