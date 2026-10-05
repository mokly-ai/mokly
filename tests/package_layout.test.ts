import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  CLI_PACKAGE_PATH,
  cliLockKey,
  cliPackageRoot,
} from "../scripts/package/layout.mjs";

import { cliBinPath, packageRoot, repositoryRoot } from "./helpers/fixture.js";

test("CLI layout maps root and workspace directories to package paths and lock keys", () => {
  const root = path.resolve("fixture-repository");
  assert.equal(cliLockKey("."), "");
  assert.equal(cliLockKey("packages/mokly"), "packages/mokly");
  assert.equal(cliPackageRoot(root, "."), root);
  assert.equal(
    cliPackageRoot(root, "packages/mokly"),
    path.join(root, "packages/mokly"),
  );
  assert.equal(cliLockKey(), cliLockKey(CLI_PACKAGE_PATH));
  assert.equal(cliPackageRoot(root), cliPackageRoot(root, CLI_PACKAGE_PATH));
});

test("test fixtures resolve the same CLI package and executable as package tooling", () => {
  assert.equal(packageRoot, cliPackageRoot(repositoryRoot));
  assert.equal(cliBinPath, path.join(packageRoot, "dist/cli/bin.js"));
});
