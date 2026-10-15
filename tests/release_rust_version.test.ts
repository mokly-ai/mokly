import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";

// Cargo's unpublished crate version does not follow an npm Release Please bump.
// Every Rust package-version path must use the npm-derived shared version.
test("Rust package-version paths cannot use the independent Cargo crate version", async () => {
  const failures: string[] = [];
  for (const file of await rustFiles(path.join(repositoryRoot, "crates"))) {
    const source = await fs.readFile(file, "utf8");
    if (
      /\b(?:env|option_env)!\s*\(\s*"CARGO_PKG_VERSION(?:_[A-Z]+)?"/u.test(
        source,
      )
    )
      failures.push(path.relative(repositoryRoot, file));
  }
  assert.deepEqual(
    failures,
    [],
    "Use the shared version derived from packages/mokly/package.json, including hello, cache keys, user-agent, and Rust test expectations.",
  );
});

async function rustFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await rustFiles(file)));
    else if (entry.isFile() && entry.name.endsWith(".rs")) result.push(file);
  }
  return result;
}
