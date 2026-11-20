import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { inc, major } from "semver";

import { releasePackages } from "../scripts/release/targets.mjs";
import { releaseUpdates } from "../scripts/release/version_updates.mjs";
import { verifyPackageVersions } from "../scripts/release/versions.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

const json = async (file: string) =>
  JSON.parse(await fs.readFile(path.join(repositoryRoot, file), "utf8"));

/** Fixed release inputs: after the 0.15.0 release, a breaking release is 0.16.0. */
const FIXED_MANIFEST = { ".": "0.15.0", "packages/viewer": "0.6.0" };

test("cloud changes do not create a published package release", async () => {
  const cloudCrates = (
    await fs.readdir(path.join(repositoryRoot, "crates"))
  ).filter((name) => name.startsWith("mkc-"));
  const cloudPaths = new Map([
    ["apps", "apps/site/src/home.ts"],
    ["packages/app", "packages/app/src/index.ts"],
    ["packages/desktop", "packages/desktop/src/main.ts"],
    ...cloudCrates.map((name): [string, string] => [
      `crates/${name}`,
      `crates/${name}/src/lib.rs`,
    ]),
    ["packages/tokens", "packages/tokens/src/tokens.ts"],
    ["infra", "infra/terraform/modules/github/main.tf"],
    ["scripts/cloud", "scripts/cloud/site/cleanup.sh"],
    ["docs/protocol/cloud", "docs/protocol/cloud/rest-api.md"],
    ["docs/mockups", "docs/mockups/src/index.ts"],
    ["docs/ops", "docs/ops/deploy.md"],
    ["docs/api", "docs/api/openapi.json"],
    ["fixtures", "fixtures/desktop-origin.json"],
    ["rules", "rules/rust/no-inline-use.yml"],
  ]);
  const exclusions: unknown = (await json("release-please-config.json"))
    .packages["."]["exclude-paths"];
  assert.ok(Array.isArray(exclusions));
  for (const [cloudPath, file] of cloudPaths) {
    assert.ok(exclusions.includes(cloudPath), `${cloudPath} must be excluded`);
    const updates = await releaseUpdates(
      repositoryRoot,
      [file],
      FIXED_MANIFEST,
      ["."],
    );
    assert.deepEqual([...updates], [], file);
  }
  const updates = await releaseUpdates(
    repositoryRoot,
    [...cloudPaths.values()],
    FIXED_MANIFEST,
    ["."],
  );
  assert.deepEqual([...updates], []);
});

test("the private workspace releases the CLI, UI, model, frame, and viewer packages with one root version", async () => {
  await verifyPackageVersions(repositoryRoot);
  const [manifest, config, versions] = await Promise.all([
    json("package.json"),
    json("release-please-config.json"),
    json(".release-please-manifest.json"),
  ]);
  for (const key of ["bin", "exports", "files", "publishConfig", "types"])
    assert.equal(manifest[key], undefined, key);
  assert.deepEqual(Object.keys(config.packages), [".", "packages"]);
  assert.deepEqual(Object.keys(versions).sort(), [
    ".",
    "packages",
    "packages/viewer",
  ]);
  assert.equal(config.plugins, undefined);
  const entry = config.packages["."];
  assert.equal(entry.component, "mokly");
  assert.equal(entry["release-type"], "node");
  assert.equal(entry["include-component-in-tag"], false);
  assert.equal(entry["include-v-in-tag"], true);
  assert.equal(entry["bump-minor-pre-major"], true);
  for (const manifest of [
    "/packages/viewer/package.json",
    "/packages/ui/package.json",
    "/packages/model/package.json",
    "/packages/frame/package.json",
  ])
    assert.ok(
      Array.isArray(entry["extra-files"]) &&
        entry["extra-files"].some(
          (file: unknown) =>
            typeof file === "object" &&
            file !== null &&
            "path" in file &&
            file.path === manifest,
        ),
      manifest,
    );
});

test("pinned Release Please updates all manifest and lockfile edges and retains changelog history", async (t) => {
  const sourceHistory = await fs.readFile(
    path.join(repositoryRoot, "CHANGELOG.md"),
    "utf8",
  );
  const released: string = (await json(".release-please-manifest.json"))["."];
  // A breaking change bumps the minor version before 1.0 (`bump-minor-pre-major`).
  const next = inc(released, major(released) === 0 ? "minor" : "major");
  assert.ok(next, released);
  for (const changed of [
    ["crates/mokly-css/src/compiler.rs"],
    ["packages/mokly/src/index.ts"],
    ["packages/viewer/src/index.ts"],
    ["packages/ui/scripts/build.mjs"],
    ["packages/model/src/index.ts"],
    ["packages/frame/src/index.ts"],
    ["packages/mokly/src/index.ts", "packages/viewer/src/index.ts"],
  ]) {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "mokly-release-versions-"),
    );
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const fixed = await releaseUpdates(
      repositoryRoot,
      changed,
      FIXED_MANIFEST,
      ["."],
    );
    assert.match(
      fixed.get("packages/viewer/CHANGELOG.md") ?? "",
      /Shared release version: 0\.16\.0/,
    );
    const updates = await releaseUpdates(repositoryRoot, changed, undefined, [
      ".",
    ]);
    const lock = JSON.parse(updates.get("package-lock.json") ?? "null");
    assert.ok(lock);
    for (const file of [
      ...["mockups", "site", "worker"].map(
        (project) => `apps/${project}/package.json`,
      ),
      ...["app", "desktop", "tokens"].map(
        (project) => `packages/${project}/package.json`,
      ),
    ]) {
      const content = updates.get(file);
      const before = await json(file);
      const after = content ? JSON.parse(content) : before;
      if (content) assert.equal(after.version, before.version, file);
      const directory = path.posix.dirname(file);
      assert.equal(lock.packages[directory].version, before.version, file);
      for (const group of ["dependencies", "devDependencies"]) {
        for (const name of Object.keys(before[group] ?? {})) {
          if (!name.startsWith("@mokly/")) continue;
          assert.equal(after[group][name], next, `${file} ${name}`);
          assert.equal(
            lock.packages[directory][group][name],
            next,
            `package-lock.json ${directory} ${name}`,
          );
        }
      }
    }
    assert.equal(
      [...updates.keys()].some((file) =>
        /^(?:apps|crates\/mkc-|packages\/(?:app|desktop|tokens)\/).*CHANGELOG/.test(
          file,
        ),
      ),
      false,
    );
    assert.ok(updates.has("packages/mokly/package.json"));
    assert.ok(updates.has("packages/viewer/package.json"));
    assert.ok(updates.has("packages/ui/package.json"));
    assert.ok(updates.has("packages/model/package.json"));
    assert.ok(updates.has("packages/frame/package.json"));
    for (const changelog of [
      "packages/viewer/CHANGELOG.md",
      "packages/ui/CHANGELOG.md",
      "packages/model/CHANGELOG.md",
      "packages/frame/CHANGELOG.md",
    ]) {
      const history = updates.get(changelog) ?? "";
      assert.ok(history.includes(`Shared release version: ${next}`), history);
    }
    for (const file of [
      "package.json",
      "package-lock.json",
      ".release-please-manifest.json",
      ...releasePackages().map(({ directory }) => `${directory}/package.json`),
    ]) {
      const destination = path.join(root, file);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(path.join(repositoryRoot, file), destination);
    }
    assert.ok(
      updates
        .get("CHANGELOG.md")
        ?.includes(sourceHistory.slice(sourceHistory.indexOf("\n") + 1).trim()),
    );
    assert.ok(!updates.has("packages/mokly/CHANGELOG.md"));
    for (const [file, content] of updates) {
      const destination = path.join(root, file);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, content);
    }
    const { cli, viewer, ui, model, frame } = await verifyPackageVersions(root);
    assert.equal(cli.version, next);
    assert.notEqual(
      cli.version,
      (await json("packages/mokly/package.json")).version,
    );
    assert.equal(viewer.version, cli.version);
    assert.equal(ui.version, cli.version);
    assert.equal(model.version, cli.version);
    assert.equal(frame.version, cli.version);
    assert.match(cli.version, /^0\./);
    assert.match(viewer.version, /^0\./);
  }
});

test("the desktop release covers its bundle and starts at 0.1.0", async () => {
  const config = (await json("release-please-config.json")).packages.packages;
  assert.equal(
    (await json("release-please-config.json"))["separate-pull-requests"],
    true,
  );
  assert.equal(config.component, "desktop");
  assert.equal(config["include-component-in-tag"], true);
  assert.equal(config.prerelease, true);
  const desktop = await json("packages/desktop/package.json");
  for (const file of [
    "packages/desktop/src/main.ts",
    "packages/app/src/index.ts",
    "packages/tokens/src/tokens.ts",
    "packages/viewer/src/index.ts",
    "packages/ui/scripts/build.mjs",
    "packages/model/src/index.ts",
    "packages/frame/src/index.ts",
  ]) {
    const updates = await releaseUpdates(repositoryRoot, [file], undefined, [
      "packages",
    ]);
    assert.deepEqual(
      [...updates.keys()].sort(),
      [
        ".release-please-manifest.json",
        "package-lock.json",
        "packages/desktop/CHANGELOG.md",
        "packages/desktop/package.json",
      ],
      file,
    );
    const after = JSON.parse(updates.get("packages/desktop/package.json")!);
    assert.deepEqual(after, { ...desktop, version: "0.1.0" }, file);
    const lock = JSON.parse(updates.get("package-lock.json")!);
    assert.equal(lock.packages["packages/desktop"].version, "0.1.0", file);
    assert.match(updates.get("packages/desktop/CHANGELOG.md")!, /## 0\.1\.0/);
  }
  for (const file of [
    "packages/mokly/src/index.ts",
    "packages/native-darwin-x64/package.json",
    "apps/site/src/home.ts",
    "crates/mokly-css/src/compiler.rs",
  ]) {
    const updates = await releaseUpdates(repositoryRoot, [file], undefined, [
      "packages",
    ]);
    assert.deepEqual([...updates], [], file);
  }
});
