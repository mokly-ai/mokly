import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { bootstrapCli, isSupportedNodeVersion } from "../dist/cli/bootstrap.js";

import { repositoryRoot } from "./helpers/fixture.js";

const VERSION_CASES = [
  ["22.13.99", false],
  ["22.14.0", true],
  ["23.11.1", true],
  ["24.13.99", true],
  ["24.14.0", false],
  ["24.18.99", false],
  ["24.19.0", true],
  ["24.21.0", true],
  ["25.0.0", true],
  ["invalid", false],
] as const;

test("Node compatibility matches every engine-range boundary", () => {
  for (const [version, supported] of VERSION_CASES)
    assert.equal(isSupportedNodeVersion(version), supported, version);
});

test("the CLI rejects an affected Node before loading application modules", async () => {
  let loaded = false;
  const errors: string[] = [];

  await bootstrapCli({
    load: async () => {
      loaded = true;
    },
    nodeVersion: "24.18.99",
    reportUnsupported: (message) => errors.push(message),
  });

  assert.equal(loaded, false);
  assert.equal(errors.length, 1);
  assert.match(errors[0]!, /24\.14\.0.*24\.18/);
});

test("the CLI loads application modules on a fixed Node release", async () => {
  let loaded = false;

  await bootstrapCli({
    load: async () => {
      loaded = true;
    },
    nodeVersion: "24.19.0",
    reportUnsupported: (message) => assert.fail(message),
  });

  assert.equal(loaded, true);
});

test("the executable statically loads only the Node bootstrap", async () => {
  const [binSource, bootstrapSource] = await Promise.all([
    fs.readFile(path.join(repositoryRoot, "dist/cli/bin.js"), "utf8"),
    fs.readFile(path.join(repositoryRoot, "dist/cli/bootstrap.js"), "utf8"),
  ]);
  assert.deepEqual(staticImports(binSource), ["./bootstrap.js"]);
  assert.deepEqual(staticImports(bootstrapSource), []);
  assert.match(binSource, /await import\("\.\/main\.js"\)/);
  assert.doesNotMatch(binSource, /from "\.\/main\.js"/);
});

function staticImports(source: string): string[] {
  return [
    ...source.matchAll(/^import\s+(?:(?:.+?)\s+from\s+)?["']([^"']+)["'];$/gmu),
  ].map((match) => match[1]!);
}
