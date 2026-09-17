import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";

test("scoped npm identity preserves the Mokly executable", async () => {
  const packageJson = JSON.parse(
    await fs.promises.readFile(
      path.join(repositoryRoot, "package.json"),
      "utf8",
    ),
  );
  assert.equal(packageJson.name, "@mokly/mokly");
  assert.equal(packageJson.author, "Mokly");
  assert.deepEqual(packageJson.bin, { mokly: "./dist/cli/bin.js" });
  assert.equal(
    packageJson.homepage,
    "https://github.com/mokly-ai/mokly#readme",
  );
  assert.deepEqual(packageJson.repository, {
    type: "git",
    url: "git+https://github.com/mokly-ai/mokly.git",
  });
  assert.deepEqual(packageJson.bugs, {
    url: "https://github.com/mokly-ai/mokly/issues",
  });
  assert.deepEqual(packageJson.publishConfig, {
    access: "public",
    registry: "https://registry.npmjs.org/",
  });
  const lock = JSON.parse(
    await fs.promises.readFile(
      path.join(repositoryRoot, "package-lock.json"),
      "utf8",
    ),
  );
  assert.equal(lock.name, packageJson.name);
  assert.equal(lock.packages[""].name, packageJson.name);
  assert.deepEqual(lock.packages[""].bin, { mokly: "dist/cli/bin.js" });
});

test("release-please owns the Node manifest and first release state", async () => {
  const config = JSON.parse(
    await fs.promises.readFile(
      path.join(repositoryRoot, "release-please-config.json"),
      "utf8",
    ),
  );
  const manifest = JSON.parse(
    await fs.promises.readFile(
      path.join(repositoryRoot, ".release-please-manifest.json"),
      "utf8",
    ),
  );
  assert.equal(
    config.packages["."].releaseType ?? config.packages["."]["release-type"],
    "node",
  );
  assert.equal(config.packages["."]["include-v-in-tag"], true);
  assert.equal(
    config["bootstrap-sha"],
    "896a6ecfd26236b1695c7683e7acac73dc4efbc9",
  );
  assert.equal(config.packages["."]["bump-minor-pre-major"], true);
  const releaseAs = config.packages["."]["release-as"];
  if (releaseAs !== undefined) {
    assert.match(releaseAs, /^0\.\d+\.\d+$/);
  }
  assert.equal(config.packages["."]["include-component-in-tag"], false);
  assert.deepEqual(
    Object.keys(config.packages["."])
      .filter((key) => key !== "release-as")
      .sort(),
    [
      "bump-minor-pre-major",
      "changelog-path",
      "include-component-in-tag",
      "include-v-in-tag",
      "release-type",
    ],
  );
  const packageVersion = JSON.parse(
    await fs.promises.readFile(
      path.join(repositoryRoot, "package.json"),
      "utf8",
    ),
  ).version;
  assert.equal(manifest["."], packageVersion);
  const viewer = JSON.parse(
    await fs.promises.readFile(
      path.join(repositoryRoot, "packages/viewer/package.json"),
      "utf8",
    ),
  );
  assert.equal(
    manifest["packages/viewer"],
    manifest["packages/viewer"] === "0.0.0" ? "0.0.0" : viewer.version,
  );
  if (manifest["packages/viewer"] === "0.0.0")
    assert.equal(viewer.version, "0.1.0");
  assert.deepEqual(Object.keys(config.packages), [".", "packages/viewer"]);
  assert.deepEqual(config.plugins, [
    { type: "node-workspace", updateAllPackages: true },
  ]);
  assert.deepEqual(config.packages["packages/viewer"], {
    "release-type": "node",
    component: "viewer",
    "changelog-path": "CHANGELOG.md",
    "include-component-in-tag": true,
    "include-v-in-tag": true,
    "bump-minor-pre-major": true,
    "extra-files": [
      {
        type: "json",
        path: "/package-lock.json",
        jsonpath: "$['packages']['']['dependencies']['@mokly/viewer']",
      },
    ],
  });
  const root = JSON.parse(
    await fs.promises.readFile(
      path.join(repositoryRoot, "package.json"),
      "utf8",
    ),
  );
  assert.equal(root.dependencies["@mokly/viewer"], viewer.version);
});
