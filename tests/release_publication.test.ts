import assert from "node:assert/strict";
import test from "node:test";

import { publishPackages } from "../scripts/release/publication.mjs";
import { releasePackages } from "../scripts/release/targets.mjs";

const packages = releasePackages().map(({ name, artifact }) => ({
  archivePath: `/archives/${artifact}.tgz`,
  report: {
    name,
    version: "0.15.0",
    filename: `${artifact}.tgz`,
    integrity: "sha512-fixture",
    shasum: "a".repeat(40),
    files: [],
    sourceCommit: "a".repeat(40),
    sourceTree: "b".repeat(40),
  },
}));

test("publication verifies platforms, UI package, viewer and CLI in order and skips matching versions", async () => {
  const events: string[] = [];
  await publishPackages("/checkout", packages, {
    verify: async ({ mode, localReport, distTag }) => {
      events.push(`${mode} ${localReport.name}`);
      if (mode === "verify") assert.equal(distTag, "latest");
      return localReport.name === packages[0]!.report.name;
    },
    execute: async (file, args) => {
      assert.equal(file, "npm");
      assert.deepEqual(args.slice(2), [
        "--access",
        "public",
        "--ignore-scripts",
      ]);
      events.push(`publish ${args[1]}`);
    },
  });
  assert.deepEqual(
    events,
    packages.flatMap(({ archivePath, report }, index) => [
      `guard ${report.name}`,
      ...(index ? [`publish ${archivePath}`] : []),
      `verify ${report.name}`,
    ]),
  );
  assert.deepEqual(
    packages.slice(-3).map(({ report }) => report.name),
    ["@mokly/ui", "@mokly/viewer", "@mokly/mokly"],
  );
});

test("a registry or publish failure prevents every later publication", async () => {
  for (const failure of ["guard", "publish", "verify"]) {
    const events: string[] = [];
    await assert.rejects(
      publishPackages("/checkout", packages, {
        verify: async ({ mode, localReport }) => {
          events.push(localReport.name);
          if (mode === failure) throw new Error(failure);
          return false;
        },
        execute: async () => {
          if (failure === "publish") throw new Error(failure);
        },
      }),
      new RegExp(failure),
    );
    assert.ok(events.every((name) => name === packages[0]!.report.name));
  }
});
