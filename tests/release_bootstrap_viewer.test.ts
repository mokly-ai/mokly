import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  bootstrapFixture,
  bootstrapModule,
} from "./helpers/bootstrap_fixture.js";

test("viewer first publication packs only reviewed viewer bytes with source proof", async (t) => {
  const fixture = await bootstrapFixture(t, { version: "0.10.0" });
  const { createBootstrapArchive } = await bootstrapModule();
  const { archivePath, report } = await createBootstrapArchive({
    ...fixture,
    repositoryRoot: fixture.root,
    packageName: "@mokly/viewer",
  });
  assert.equal(report.name, "@mokly/viewer");
  assert.equal(report.version, "0.1.0");
  assert.equal(report.filename, "mokly-viewer-0.1.0.tgz");
  assert.equal(report.sourceCommit, fixture.expectedCommit);
  assert.equal(
    report.sourceTree,
    await fixture.git("rev-parse", "HEAD^{tree}"),
  );
  assert.ok(report.files.some((file) => file.path === "dist/server.js"));
  assert.ok(report.files.some((file) => file.path === "CHANGELOG.md"));
  assert.equal(
    report.files.some((file) => file.path.startsWith("dist/cli/")),
    false,
  );
  assert.ok((await fs.stat(archivePath)).size > 0);
  assert.equal(await fixture.git("status", "--porcelain"), "");
});

test("viewer bootstrap rejects later versions and lifecycle source mutations", async (t) => {
  const { createBootstrapArchive } = await bootstrapModule();
  const changed = await bootstrapFixture(t, {
    afterBuild: 'await fs.writeFile("source.txt", "unreviewed");',
  });
  await assert.rejects(
    createBootstrapArchive({
      ...changed,
      repositoryRoot: changed.root,
      packageName: "@mokly/viewer",
    }),
    /clean.*source|source.*clean/i,
  );
  const fixture = await bootstrapFixture(t);
  const filename = path.join(fixture.root, "packages/viewer/package.json");
  const metadata = JSON.parse(await fs.readFile(filename, "utf8")) as {
    version: string;
  };
  metadata.version = "0.2.0";
  await fs.writeFile(filename, JSON.stringify(metadata));
  await fixture.git("add", "-A");
  await fixture.git(
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-m",
    "test: later viewer",
  );
  await assert.rejects(
    createBootstrapArchive({
      ...fixture,
      expectedCommit: await fixture.git("rev-parse", "HEAD"),
      repositoryRoot: fixture.root,
      packageName: "@mokly/viewer",
    }),
    /@mokly\/viewer@0\.1\.0/,
  );
});
