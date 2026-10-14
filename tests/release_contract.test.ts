import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { viewerPackageReport } from "./helpers/release_fixture.js";

const { comparePublishedPackage } = (await import(
  pathToFileURL(
    path.resolve(
      import.meta.dirname,
      "../scripts/release/registry_contract.mjs",
    ),
  ).href
)) as {
  comparePublishedPackage(
    local: ReturnType<typeof viewerPackageReport>,
    remote: ReturnType<typeof viewerPackageReport>,
    metadata: { gitHead?: string },
    commit: string,
  ): void;
};

test("the viewer registry guard requires exact bytes, inventory, and commit", () => {
  const local = viewerPackageReport();
  const commit = "a".repeat(40);
  comparePublishedPackage(
    local,
    structuredClone(local),
    { gitHead: commit },
    commit,
  );
  for (const mutation of [
    { integrity: "sha512-other" },
    { shasum: "c".repeat(40) },
    { version: "0.2.0" },
    { files: [...local.files, { path: "dist/extra.js", size: 1 }] },
  ])
    assert.throws(
      () =>
        comparePublishedPackage(
          local,
          { ...local, ...mutation },
          { gitHead: commit },
          commit,
        ),
      /differs/,
    );
  assert.throws(
    () =>
      comparePublishedPackage(
        local,
        local,
        { gitHead: "b".repeat(40) },
        commit,
      ),
    /gitHead differs/,
  );
});
