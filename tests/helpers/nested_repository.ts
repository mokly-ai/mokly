import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";
import { promisify } from "node:util";

import {
  compileCatalogue,
  type Compilation,
} from "../../packages/mokly/dist/build/compile.js";
import { writeCompilation } from "../../packages/mokly/dist/build/transaction.js";
import { loadConfig } from "../../packages/mokly/dist/config/load.js";
import type { ResolvedConfig } from "../../packages/mokly/dist/config/types.js";

import { createFixture, removeFixture } from "./fixture.js";

type NestedRepositoryResult = {
  config: ResolvedConfig;
  compilation: Compilation;
  root: string;
};

/** Valid committed output inside a Git repo whose config incorrectly roots a subdirectory. */
export async function nestedRepository(
  t: TestContext,
): Promise<NestedRepositoryResult> {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const nested = path.join(fixture.root, "catalogue");
  await fs.mkdir(nested);
  for (const name of ["entries", "mockups", "notes.md", "mokly.config.ts"])
    await fs.rename(path.join(fixture.root, name), path.join(nested, name));
  const config = await loadConfig(nested);
  const compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
  const git = (...args: string[]) =>
    promisify(execFile)("git", args, { cwd: fixture.root });
  await git("init", "-q");
  await git("add", ".");
  await git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.test",
    "commit",
    "-qm",
    "test: nested catalogue",
  );
  return { config, compilation, root: fixture.root };
}
