import assert from "node:assert/strict";
import fs from "node:fs/promises";

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PEERS = { react: ">=19.0.0", "react-dom": ">=19.0.0" };
const entry = (name, condition = "import") => ({
  types: `./dist/${name}.d.ts`,
  [condition]: `./dist/${name}.js`,
});
const CLI_EXPORTS = { ".": entry("index") };
const VIEWER_EXPORTS = {
  ".": entry("index"),
  "./server": entry("server", "node"),
  "./runtime": entry("runtime"),
  "./data": entry("data"),
  "./styles.css": "./dist/styles.css",
};

/** Validate the public contract in either source or packed package metadata. */
export function validatePackageManifest(metadata, name) {
  assert.ok(["@mokly/mokly", "@mokly/viewer"].includes(name));
  const viewer = name === "@mokly/viewer";
  assert.equal(metadata.name, name);
  assert.match(metadata.version, VERSION);
  assert.equal(metadata.license, "MIT");
  assert.equal(metadata.type, "module");
  assert.notEqual(metadata.private, true);
  assert.equal(metadata.types, "./dist/index.d.ts");
  assert.deepEqual(metadata.exports, viewer ? VIEWER_EXPORTS : CLI_EXPORTS);
  assert.deepEqual(metadata.peerDependencies, PEERS);
  assert.deepEqual(metadata.publishConfig, {
    access: "public",
    registry: "https://registry.npmjs.org/",
  });
  assert.deepEqual(metadata.repository, {
    type: "git",
    url: "git+https://github.com/mokly-ai/mokly.git",
    ...(viewer ? { directory: "packages/viewer" } : {}),
  });
  assert.deepEqual(
    [...metadata.files].sort(),
    [
      "dist",
      "CHANGELOG.md",
      "LICENSE",
      "README.md",
      ...(viewer ? [] : ["docs/protocol"]),
    ].sort(),
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
  if (viewer) {
    assert.equal(metadata.dependencies?.["@mokly/mokly"], undefined);
    assert.deepEqual(metadata.sideEffects, ["./dist/styles.css"]);
    assert.equal(metadata.bin, undefined);
  } else {
    assert.deepEqual(metadata.bin, { mokly: "./dist/cli/bin.js" });
    assert.match(
      metadata.dependencies?.["@mokly/viewer"] ?? "",
      VERSION,
      "CLI must depend on an exact viewer version",
    );
  }
}

export function validateVersionPair(cli, viewer) {
  assert.match(viewer.version, VERSION);
  assert.equal(
    cli.dependencies?.["@mokly/viewer"],
    viewer.version,
    "CLI must depend on the exact viewer version",
  );
}

export function validateLockPair(lock, cli, viewer) {
  assert.equal(lock.name, cli.name);
  assert.equal(lock.version, cli.version);
  assert.equal(lock.packages[""].version, cli.version);
  assert.equal(lock.packages["packages/viewer"].version, viewer.version);
  assert.equal(
    lock.packages[""].dependencies["@mokly/viewer"],
    viewer.version,
    "lockfile must use the exact viewer version",
  );
  assert.equal(
    lock.packages["node_modules/@mokly/viewer"].resolved,
    "packages/viewer",
  );
  assert.equal(lock.packages["node_modules/@mokly/viewer"].link, true);
}

export function validateExportFiles(metadata, report) {
  const targets = Object.values(metadata.exports).flatMap((value) =>
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
