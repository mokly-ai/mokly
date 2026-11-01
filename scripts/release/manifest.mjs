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

/** A component subpath of the UI package. */
const UI_SUBPATH = /^\.\/([a-z0-9]+(?:-[a-z0-9]+)*)$/u;

/** Validate the public contract in either source or packed package metadata. */
export function validatePackageManifest(metadata, name) {
  if (name === "@mokly/ui") return validateUiManifest(metadata);
  if (name !== "@mokly/viewer") return validateCliOrNative(metadata, name);
  validateBrowserPackage(metadata, name, "packages/viewer");
  assert.equal(metadata.types, "./dist/index.d.ts");
  assert.deepEqual(metadata.exports, VIEWER_EXPORTS);
  assert.match(metadata.dependencies?.["@mokly/ui"] ?? "", VERSION);
  assert.deepEqual(metadata.sideEffects, [
    "./dist/browser.js",
    "./dist/styles.css",
  ]);
}

/**
 * The UI package has no root entry: one subpath per component and
 * `styles.css` as its only stylesheet subpath, with every component's rules.
 */
function validateUiManifest(metadata) {
  validateBrowserPackage(metadata, "@mokly/ui", "packages/ui");
  assert.equal(metadata.types, undefined, "@mokly/ui has no root entry");
  assert.equal(metadata.main, undefined, "@mokly/ui has no root entry");
  assert.equal(metadata.exports?.["./styles.css"], "./dist/styles.css");
  for (const [subpath, target] of Object.entries(metadata.exports)) {
    if (subpath === "./styles.css") continue;
    const [, component] = UI_SUBPATH.exec(subpath) ?? [];
    assert.ok(component, `@mokly/ui exports ${subpath}, not a component`);
    const file = `./dist/${component}/${component}`;
    assert.deepEqual(
      target,
      { types: `${file}.d.ts`, import: `${file}.js` },
      subpath,
    );
  }
  for (const field of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
  ])
    for (const dependency of Object.keys(metadata[field] ?? {}))
      assert.ok(
        !dependency.startsWith("@mokly/"),
        `@mokly/ui must not depend on ${dependency}`,
      );
  assert.deepEqual(metadata.sideEffects, ["*.css"]);
}

/** The contract of an MIT ESM browser package with React peers. */
function validateBrowserPackage(metadata, name, directory) {
  assert.equal(metadata.name, name);
  assert.match(metadata.version, VERSION);
  assert.equal(metadata.license, "MIT");
  assert.equal(metadata.type, "module");
  assert.notEqual(metadata.private, true);
  assert.deepEqual(metadata.peerDependencies, PEERS);
  assert.deepEqual(metadata.publishConfig, {
    access: "public",
    registry: "https://registry.npmjs.org/",
  });
  assert.deepEqual(metadata.repository, {
    type: "git",
    url: "git+https://github.com/mokly-ai/mokly.git",
    directory,
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
      "CHANGELOG.md",
      "LICENSE",
      "README.md",
      "docs/guides",
      "docs/protocol",
    ].sort(),
  );
}
