import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { SUPPORTED_NODE_RANGE } from "../../packages/mokly/src/version.mjs";

import { NATIVE_TARGETS, nativeTarget } from "./targets.mjs";

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PEERS = { react: ">=19.0.0", "react-dom": ">=19.0.0" };
const entry = (name, condition = "import") => ({
  types: `./dist/${name}.d.ts`,
  [condition]: `./dist/${name}.js`,
});
const VIEWER_EXPORTS = {
  ".": entry("index"),
  "./browser": entry("browser"),
  "./data": entry("data"),
  "./styles.css": "./dist/styles.css",
};

/** Validate the public contract in either source or packed package metadata. */
export function validatePackageManifest(metadata, name) {
  if (name !== "@mokly/viewer") return validateCliOrNative(metadata, name);
  assert.equal(metadata.name, name);
  assert.match(metadata.version, VERSION);
  assert.equal(metadata.license, "MIT");
  assert.equal(metadata.type, "module");
  assert.notEqual(metadata.private, true);
  assert.equal(metadata.types, "./dist/index.d.ts");
  assert.deepEqual(metadata.exports, VIEWER_EXPORTS);
  assert.deepEqual(metadata.peerDependencies, PEERS);
  assert.deepEqual(metadata.publishConfig, {
    access: "public",
    registry: "https://registry.npmjs.org/",
  });
  assert.deepEqual(metadata.repository, {
    type: "git",
    url: "git+https://github.com/mokly-ai/mokly.git",
    directory: "packages/viewer",
  });
  assert.deepEqual(
    [...metadata.files].sort(),
    ["dist", "CHANGELOG.md", "LICENSE", "README.md"].sort(),
  );
  for (const field of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
    "devDependencies",
  ]) {
    for (const value of Object.values(metadata[field] ?? {})) {
      assert.equal(typeof value, "string");
      assert.doesNotMatch(
        value,
        /^(?:workspace:|file:|link:|\.\.?\/)/,
        `${name} has a local dependency`,
      );
    }
  }
  assert.equal(metadata.dependencies?.["@mokly/mokly"], undefined);
  assert.deepEqual(metadata.sideEffects, [
    "./dist/browser.js",
    "./dist/styles.css",
  ]);
  assert.equal(metadata.bin, undefined);
}

export function validateExportFiles(metadata, report) {
  const targets = Object.values(metadata.exports ?? {}).flatMap((value) =>
    typeof value === "string" ? [value] : Object.values(value),
  );
  for (const target of targets) {
    assert.ok(
      report.files.some(({ path }) => path === target.slice(2)),
      `packed export is missing ${target}`,
    );
  }
}

export async function readPackageManifest(root) {
  return JSON.parse(await fs.readFile(`${root}/package.json`, "utf8"));
}

function validateCliOrNative(metadata, name) {
  const cli = name === "@mokly/mokly";
  const target = cli ? undefined : nativeTarget(name);
  assert.equal(metadata.name, name);
  assert.match(metadata.version, VERSION);
  assert.equal(metadata.license, "MIT");
  assert.notEqual(metadata.private, true);
  assert.deepEqual(metadata.publishConfig, {
    access: "public",
    registry: "https://registry.npmjs.org/",
  });
  assert.deepEqual(metadata.repository, {
    type: "git",
    url: "git+https://github.com/mokly-ai/mokly.git",
    directory: cli ? "packages/mokly" : target.directory,
  });
  for (const field of [
    "dependencies",
    "optionalDependencies",
    "devDependencies",
    "peerDependencies",
  ]) {
    for (const value of Object.values(metadata[field] ?? {})) {
      assert.equal(typeof value, "string");
      assert.doesNotMatch(
        value,
        /^(?:workspace:|file:|link:|\.\.?\/)/,
        `${name} has a local dependency`,
      );
    }
  }
  if (!cli) {
    assert.deepEqual(metadata.os, [target.os]);
    assert.deepEqual(metadata.cpu, [target.cpu]);
    assert.deepEqual(metadata.libc, target.libc ? [target.libc] : undefined);
    assert.deepEqual(metadata.files, [`bin/${target.executable}`]);
    for (const field of [
      "dependencies",
      "optionalDependencies",
      "peerDependencies",
      "bin",
      "exports",
    ])
      assert.equal(metadata[field], undefined);
    return;
  }
  assert.equal(metadata.type, "module");
  assert.equal(metadata.author, "Mokly");
  assert.equal(metadata.homepage, "https://github.com/mokly-ai/mokly#readme");
  assert.deepEqual(metadata.bugs, {
    url: "https://github.com/mokly-ai/mokly/issues",
  });
  assert.equal(metadata.engines?.node, SUPPORTED_NODE_RANGE);
  assert.deepEqual(metadata.bin, { mokly: "./bin/mokly.mjs" });
  assert.equal(metadata.types, "./dist/index.d.ts");
  assert.deepEqual(metadata.exports, {
    ".": entry("index"),
    "./package.json": "./package.json",
  });
  assert.deepEqual(metadata.peerDependencies, PEERS);
  assert.deepEqual(metadata.peerDependenciesMeta, {
    react: { optional: true },
    "react-dom": { optional: true },
  });
  assert.match(metadata.dependencies?.["@mokly/viewer"] ?? "", VERSION);
  assert.deepEqual(
    metadata.optionalDependencies,
    Object.fromEntries(
      NATIVE_TARGETS.map(({ name }) => [name, metadata.version]),
    ),
  );
  assert.deepEqual(
    [...metadata.files].sort(),
    [
      "bin",
      "dist",
      "config.schema.json",
      "LICENSE",
      "README.md",
      "docs/guides",
      "docs/protocol",
    ].sort(),
  );
}
