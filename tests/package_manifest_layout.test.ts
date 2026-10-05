import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  validateLockPair,
  validatePackageManifest,
} from "../scripts/package/manifest.mjs";

import { packageRoot, repositoryRoot } from "./helpers/fixture.js";

const cli = JSON.parse(
  await fs.readFile(path.join(packageRoot, "package.json"), "utf8"),
);
delete cli.repository.directory;
const viewer = JSON.parse(
  await fs.readFile(
    path.join(repositoryRoot, "packages/viewer/package.json"),
    "utf8",
  ),
);

function lockFor(cliPath: string) {
  return {
    name: cliPath === "." ? cli.name : "mokly-workspace",
    version: cliPath === "." ? cli.version : "0.0.0",
    packages: {
      [cliPath === "." ? "" : cliPath]: {
        version: cli.version,
        dependencies: { "@mokly/viewer": viewer.version },
      },
      "packages/viewer": { version: viewer.version },
      "node_modules/@mokly/viewer": { resolved: "packages/viewer", link: true },
      ...(cliPath === "."
        ? {}
        : {
            "": { name: "mokly-workspace" },
            "node_modules/@mokly/mokly": { resolved: cliPath, link: true },
          }),
    } as Record<
      string,
      {
        version?: string;
        dependencies?: Record<string, string>;
        resolved?: string;
        link?: boolean;
        name?: string;
      }
    >,
  };
}

test("lockfile validation preserves root metadata assertions", () => {
  const lock = lockFor(".");
  validateLockPair(lock, cli, viewer, ".");
  for (const field of ["name", "version"] as const) {
    const invalid = structuredClone(lock);
    invalid[field] = "wrong";
    assert.throws(() => validateLockPair(invalid, cli, viewer, "."));
  }
});

test("workspace lock validation checks CLI metadata and link without root version coupling", () => {
  const lock = lockFor("packages/mokly");
  validateLockPair(lock, cli, viewer, "packages/mokly");
  const invalidEntries = [
    [
      "packages/mokly",
      { version: "0.0.0", dependencies: { "@mokly/viewer": viewer.version } },
    ],
    [
      "packages/mokly",
      {
        version: cli.version,
        dependencies: { "@mokly/viewer": `^${viewer.version}` },
      },
    ],
    ["node_modules/@mokly/mokly", { resolved: "packages/other", link: true }],
    ["node_modules/@mokly/mokly", { resolved: "packages/mokly", link: false }],
    ["packages/viewer", { version: "0.0.0" }],
    ["node_modules/@mokly/viewer", { resolved: "packages/other", link: true }],
    [
      "node_modules/@mokly/viewer",
      { resolved: "packages/viewer", link: false },
    ],
  ] as const;
  for (const [key, entry] of invalidEntries) {
    const invalid = structuredClone(lock);
    invalid.packages[key] = entry;
    assert.throws(() =>
      validateLockPair(invalid, cli, viewer, "packages/mokly"),
    );
  }
  const missing = structuredClone(lock);
  delete missing.packages["node_modules/@mokly/mokly"];
  assert.throws(() => validateLockPair(missing, cli, viewer, "packages/mokly"));
});

test("CLI manifest repository directory follows the package layout", () => {
  validatePackageManifest(cli, cli.name, ".");
  const nested = structuredClone(cli);
  nested.repository.directory = "packages/mokly";
  validatePackageManifest(nested, nested.name, "packages/mokly");
  for (const invalid of [
    cli,
    {
      ...nested,
      repository: { ...nested.repository, directory: "packages/other" },
    },
  ])
    assert.throws(() =>
      validatePackageManifest(invalid, invalid.name, "packages/mokly"),
    );
});
