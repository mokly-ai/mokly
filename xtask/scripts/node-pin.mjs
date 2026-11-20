import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import semver from "semver";

const pin = process.argv[2];
assert(semver.valid(pin), "Expected the protocol Node version");
for (const file of [
  "package.json",
  "apps/site/package.json",
  "apps/worker/package.json",
]) {
  const manifest = JSON.parse(await readFile(file, "utf8"));
  assert(
    semver.satisfies(pin, manifest.engines?.node ?? ""),
    `${file}: engines.node excludes ${pin}`,
  );
  if (file !== "package.json") {
    assert.equal(
      manifest.engines.node,
      `>=${pin} <${Number(semver.major(pin)) + 1}`,
      `${file}: engines.node differs from the cloud pin`,
    );
  }
}
