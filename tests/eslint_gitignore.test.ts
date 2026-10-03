import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { ESLint } from "eslint";

import { repositoryRoot } from "./helpers/fixture.js";

const execFileAsync = promisify(execFile);

test("eslint ignores repository paths ignored by Git", async (context) => {
  const scratchParent = path.join(repositoryRoot, ".wrangler", "tmp");
  await fs.mkdir(scratchParent, { recursive: true });
  const scratchRoot = await fs.mkdtemp(
    path.join(scratchParent, "eslint-gitignore-"),
  );
  context.after(() => fs.rm(scratchRoot, { force: true, recursive: true }));

  const fixturePath = path.join(scratchRoot, "invalid.ts");
  await fs.writeFile(fixturePath, "const lintFailure = true;\n");
  const relativePath = path.relative(repositoryRoot, fixturePath);

  await execFileAsync("git", ["check-ignore", "--quiet", "--", relativePath], {
    cwd: repositoryRoot,
  });

  const eslint = new ESLint({ cwd: repositoryRoot });
  assert.equal(await eslint.isPathIgnored(fixturePath), true);
});
