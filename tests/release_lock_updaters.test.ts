import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { CLI_PACKAGE_PATH } from "../scripts/package/layout.mjs";
import { validateLockPair } from "../scripts/package/manifest.mjs";

import { packageRoot, repositoryRoot } from "./helpers/fixture.js";

interface Manifest {
  version: string;
  dependencies: Record<string, string>;
}

interface ExtraFile {
  type: string;
  path: string;
  jsonpath?: string;
}

interface ReleaseConfig {
  packages: Record<string, { "extra-files": ExtraFile[] }>;
}

const viewerPath = "packages/viewer";
const versionPaths = [
  "$['packages']['packages/mokly']['version']",
  "$['packages']['packages/viewer']['version']",
];

async function releaseFixture() {
  const read = async (file: string) =>
    JSON.parse(await fs.readFile(file, "utf8"));
  const [lock, cli, viewer, config] = await Promise.all([
    read(path.join(repositoryRoot, "package-lock.json")),
    read(path.join(packageRoot, "package.json")),
    read(path.join(repositoryRoot, viewerPath, "package.json")),
    read(path.join(repositoryRoot, "release-please-config.json")),
  ]);
  const original = { cli: cli.version, viewer: viewer.version };
  cli.version = nextPatch(cli.version);
  viewer.version = nextPatch(viewer.version);
  cli.dependencies["@mokly/viewer"] = viewer.version;
  return {
    lock: lock as Record<string, unknown>,
    cli: cli as Manifest,
    viewer: viewer as Manifest,
    config: config as ReleaseConfig,
    original,
  };
}

function nextPatch(version: string): string {
  const [major, minor, patch] = version.split(".");
  assert.ok(major && minor && patch);
  return `${major}.${minor}.${Number(patch) + 1}`;
}

function object(value: unknown): Record<string, unknown> {
  assert.ok(
    value !== null && typeof value === "object" && !Array.isArray(value),
  );
  return value as Record<string, unknown>;
}

function applyJsonPath(
  root: Record<string, unknown>,
  jsonpath: string,
  value: string,
): void {
  const keys = [...jsonpath.matchAll(/\['([^']+)'\]/g)].map(
    (match) => match[1]!,
  );
  assert.equal(jsonpath, `$${keys.map((key) => `['${key}']`).join("")}`);
  assert.ok(keys.length > 0);
  let target = root;
  for (const key of keys.slice(0, -1)) target = object(target[key]);
  const final = keys.at(-1)!;
  assert.ok(Object.hasOwn(target, final));
  target[final] = value;
}

function applyReleaseUpdates(
  fixture: Awaited<ReturnType<typeof releaseFixture>>,
): void {
  const versions: Record<string, string> = {
    [CLI_PACKAGE_PATH]: fixture.cli.version,
    [viewerPath]: fixture.viewer.version,
  };
  for (const [packagePath, metadata] of Object.entries(
    fixture.config.packages,
  )) {
    for (const update of metadata["extra-files"]) {
      if (update.type !== "json") continue;
      assert.equal(update.path, "/package-lock.json");
      assert.ok(update.jsonpath);
      const version = versions[packagePath];
      assert.ok(version);
      applyJsonPath(fixture.lock, update.jsonpath, version);
    }
  }
}

test("configured release JSON updaters keep both real workspace versions and the exact viewer edge in sync", async () => {
  const fixture = await releaseFixture();
  applyReleaseUpdates(fixture);
  validateLockPair(fixture.lock, fixture.cli, fixture.viewer);
});

test("the real release lockfile fails closed when either explicit version updater is missing", async (t) => {
  for (const missing of versionPaths) {
    await t.test(missing, async () => {
      const fixture = await releaseFixture();
      const updates = Object.values(fixture.config.packages).flatMap(
        (metadata) => metadata["extra-files"],
      );
      assert.ok(updates.some((update) => update.jsonpath === missing));
      for (const metadata of Object.values(fixture.config.packages))
        metadata["extra-files"] = metadata["extra-files"].filter(
          (update) => update.jsonpath !== missing,
        );
      applyReleaseUpdates(fixture);
      const cliMissing = missing === versionPaths[0];
      assert.throws(
        () => validateLockPair(fixture.lock, fixture.cli, fixture.viewer),
        {
          code: "ERR_ASSERTION",
          actual: cliMissing ? fixture.original.cli : fixture.original.viewer,
          expected: cliMissing ? fixture.cli.version : fixture.viewer.version,
        },
      );
    });
  }
});
