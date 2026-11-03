import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  bootstrapFixture,
  bootstrapModule,
} from "./helpers/bootstrap_fixture.js";

const registrations = [
  {
    name: "@mokly/ui",
    directory: "ui",
    version: "0.16.1",
    filename: "mokly-ui-0.16.1.tgz",
    required: "dist/styles.css",
    laterVersion: "0.17.0",
    error: /@mokly\/ui@0\.16\.1/,
  },
  {
    name: "@mokly/model",
    directory: "model",
    version: "0.18.0",
    filename: "mokly-model-0.18.0.tgz",
    required: "dist/index.js",
    laterVersion: "0.19.0",
    error: /@mokly\/model@0\.18\.0/,
  },
];

for (const registration of registrations) {
  test(`${registration.name} first publication packs only reviewed package bytes with source proof`, async (t) => {
    const fixture = await bootstrapFixture(t, {
      version: registration.version,
    });
    const { createBootstrapArchive } = await bootstrapModule();
    const { archivePath, report } = await createBootstrapArchive({
      ...fixture,
      repositoryRoot: fixture.root,
      packageName: registration.name,
    });
    assert.equal(report.name, registration.name);
    assert.equal(report.version, registration.version);
    assert.equal(report.filename, registration.filename);
    assert.equal(report.sourceCommit, fixture.expectedCommit);
    assert.equal(
      report.sourceTree,
      await fixture.git("rev-parse", "HEAD^{tree}"),
    );
    const files = report.files.map((file) => file.path);
    assert.ok(files.includes(registration.required));
    assert.ok(files.includes("CHANGELOG.md"));
    assert.equal(
      files.some((file) => file.startsWith("dist/browser/")),
      false,
    );
    assert.ok((await fs.stat(archivePath)).size > 0);
    assert.equal(
      await fs
        .access(path.join(fixture.destination, "tls-dependencies.txt"))
        .then(() => true)
        .catch(() => false),
      false,
      "a JavaScript package carries no native dependency report",
    );
    assert.equal(await fixture.git("status", "--porcelain"), "");
  });

  test(`${registration.name} bootstrap rejects later versions and lifecycle source mutations`, async (t) => {
    const { createBootstrapArchive } = await bootstrapModule();
    const changed = await bootstrapFixture(t, {
      afterBuild: 'await fs.writeFile("source.txt", "unreviewed");',
    });
    await assert.rejects(
      createBootstrapArchive({
        ...changed,
        repositoryRoot: changed.root,
        packageName: registration.name,
      }),
      /clean.*source|source.*clean/i,
    );
    const fixture = await bootstrapFixture(t);
    const filename = path.join(
      fixture.root,
      "packages",
      registration.directory,
      "package.json",
    );
    const metadata = JSON.parse(await fs.readFile(filename, "utf8")) as {
      version: string;
    };
    metadata.version = registration.laterVersion;
    await fs.writeFile(filename, JSON.stringify(metadata));
    await fixture.git("add", "-A");
    await fixture.git(
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-m",
      `test: later ${registration.directory} package`,
    );
    await assert.rejects(
      createBootstrapArchive({
        ...fixture,
        expectedCommit: await fixture.git("rev-parse", "HEAD"),
        repositoryRoot: fixture.root,
        packageName: registration.name,
      }),
      registration.error,
    );
  });
}
