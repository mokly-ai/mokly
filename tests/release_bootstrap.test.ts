import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

import {
  bootstrapFixture,
  bootstrapModule,
} from "./helpers/bootstrap_fixture.js";

const execute = promisify(execFile);

for (const dirty of ["tracked", "staged", "untracked"])
  test(`bootstrap rejects ${dirty} source changes`, async (t) => {
    const fixture = await bootstrapFixture(t);
    await fs.writeFile(
      path.join(fixture.root, dirty === "untracked" ? "new.txt" : "source.txt"),
      "unreviewed",
    );
    if (dirty === "staged") await fixture.git("add", "-A");
    const { createBootstrapArchive } = await bootstrapModule();
    await assert.rejects(
      createBootstrapArchive({ ...fixture, repositoryRoot: fixture.root }),
      /clean.*source|source.*clean/i,
    );
    await assert.rejects(fs.stat(fixture.destination), { code: "ENOENT" });
  });

test("bootstrap requires the explicit reviewed full SHA at HEAD", async (t) => {
  const fixture = await bootstrapFixture(t);
  const { createBootstrapArchive } = await bootstrapModule();
  for (const expectedCommit of [
    "",
    "main",
    "HEAD",
    fixture.expectedCommit.slice(0, 7),
  ])
    await assert.rejects(
      createBootstrapArchive({
        ...fixture,
        repositoryRoot: fixture.root,
        expectedCommit,
      }),
      /full.*commit SHA/i,
    );
  await fixture.git(
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "--allow-empty",
    "-m",
    "test: unreviewed commit",
  );
  await assert.rejects(
    createBootstrapArchive({ ...fixture, repositoryRoot: fixture.root }),
    /reviewed commit.*HEAD/i,
  );
  await assert.rejects(fs.stat(fixture.destination), { code: "ENOENT" });
});

test("bootstrap packs isolated reviewed bytes and records their source and hashes", async (t) => {
  const fixture = await bootstrapFixture(t);
  await fs.mkdir(path.join(fixture.root, "dist"));
  await fs.writeFile(
    path.join(fixture.root, "dist/stale.js"),
    "ignored unreviewed code",
  );
  await fs.writeFile(path.join(fixture.root, "dist/index.js"), "stale build");
  const { createBootstrapArchive } = await bootstrapModule();
  const { archivePath, report } = await createBootstrapArchive({
    ...fixture,
    repositoryRoot: fixture.root,
  });
  assert.equal(report.name, "@mokly/mokly");
  assert.equal(report.version, "0.8.0");
  assert.equal(report.filename, "mokly-mokly-0.8.0.tgz");
  assert.equal(path.basename(archivePath), report.filename);
  assert.equal(report.sourceCommit, fixture.expectedCommit);
  assert.equal(
    report.sourceTree,
    await fixture.git("rev-parse", "HEAD^{tree}"),
  );
  const archive = await fs.readFile(archivePath);
  assert.equal(
    report.integrity,
    `sha512-${crypto.createHash("sha512").update(archive).digest("base64")}`,
  );
  assert.equal(
    report.shasum,
    crypto.createHash("sha1").update(archive).digest("hex"),
  );
  assert.deepEqual(
    JSON.parse(
      await fs.readFile(
        path.join(fixture.destination, "pack-report.json"),
        "utf8",
      ),
    ),
    report,
  );
  assert.equal(
    report.files.some((file) => file.path === "dist/stale.js"),
    false,
  );
  const packed = await execute("tar", [
    "-xOf",
    archivePath,
    "package/dist/index.js",
  ]);
  assert.equal(packed.stdout, "reviewed source\n");
  const metadata = await execute("tar", [
    "-xOf",
    archivePath,
    "package/package.json",
  ]);
  assert.deepEqual(JSON.parse(metadata.stdout).bin, {
    mokly: "./dist/cli/bin.js",
  });
  assert.equal(
    await fs.readFile(path.join(fixture.root, "dist/index.js"), "utf8"),
    "stale build",
  );
  assert.equal(
    await fixture.git("status", "--porcelain", "--untracked-files=all"),
    "",
  );
  await assert.rejects(
    createBootstrapArchive({ ...fixture, repositoryRoot: fixture.root }),
    /destination.*exist/i,
  );
  assert.deepEqual(await fs.readFile(archivePath), archive);
});

test("bootstrap refuses release-managed versions after registration", async (t) => {
  const fixture = await bootstrapFixture(t, { version: "0.9.0" });
  const { createBootstrapArchive } = await bootstrapModule();
  await assert.rejects(
    createBootstrapArchive({ ...fixture, repositoryRoot: fixture.root }),
    /@mokly\/mokly@0\.8\.0/,
  );
  await assert.rejects(fs.stat(fixture.destination), { code: "ENOENT" });
});

for (const name of ["mokly", "other-package", "@other/mokly"])
  test(`bootstrap refuses the wrong package identity ${name}`, async (t) => {
    const fixture = await bootstrapFixture(t, { name });
    const { createBootstrapArchive } = await bootstrapModule();
    await assert.rejects(
      createBootstrapArchive({ ...fixture, repositoryRoot: fixture.root }),
      /@mokly\/mokly@0\.8\.0/,
    );
    await assert.rejects(fs.stat(fixture.destination), { code: "ENOENT" });
  });

test("bootstrap needs only the reviewed tree from a partial source clone", async (t) => {
  const fixture = await bootstrapFixture(t);
  await fs.writeFile(
    path.join(fixture.root, "retired.txt"),
    "historical content not needed by this release",
  );
  await fixture.git("add", "-A");
  await fixture.git(
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-m",
    "test: old source",
  );
  const retiredBlob = await fixture.git("rev-parse", "HEAD:retired.txt");
  await fixture.git("rm", "retired.txt");
  await fixture.git(
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-m",
    "test: remove old source",
  );
  const expectedCommit = await fixture.git("rev-parse", "HEAD");
  await fixture.git("config", "uploadpack.allowFilter", "true");
  const partial = path.join(path.dirname(fixture.root), "partial");
  await execute("git", [
    "clone",
    "--no-local",
    "--no-checkout",
    "--filter=blob:none",
    fixture.root,
    partial,
  ]);
  await execute("git", ["checkout", "--detach", expectedCommit], {
    cwd: partial,
  });
  const objects = await execute(
    "git",
    ["rev-list", "--objects", "--all", "--missing=print"],
    { cwd: partial },
  );
  assert.ok(
    objects.stdout.includes(`?${retiredBlob}`),
    "the fixture must lack an unrelated historical blob",
  );
  const { createBootstrapArchive } = await bootstrapModule();
  const { report } = await createBootstrapArchive({
    repositoryRoot: partial,
    destination: fixture.destination,
    expectedCommit,
  });
  assert.equal(report.sourceCommit, expectedCommit);
  assert.equal(
    report.files.some((file) => file.path === "retired.txt"),
    false,
  );
});

test("bootstrap supports symlinked temporary roots used on macOS", async (t) => {
  const fixture = await bootstrapFixture(t);
  const alias = path.join(path.dirname(fixture.root), "temporary-alias");
  await fs.symlink(path.dirname(fixture.root), alias, "junction");
  const previous = process.env.TMPDIR;
  process.env.TMPDIR = alias;
  try {
    const { createBootstrapArchive } = await bootstrapModule();
    const { report } = await createBootstrapArchive({
      ...fixture,
      repositoryRoot: fixture.root,
    });
    assert.equal(report.sourceCommit, fixture.expectedCommit);
    assert.deepEqual(
      (await fs.readdir(path.dirname(fixture.root))).filter((name) =>
        name.startsWith("mokly-bootstrap-"),
      ),
      [],
    );
  } finally {
    if (previous === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previous;
  }
});

test("bootstrap rejects lifecycle scripts that change tracked build inputs", async (t) => {
  const fixture = await bootstrapFixture(t, {
    afterBuild: 'await fs.writeFile("source.txt", "mutated by prepack");',
  });
  const { createBootstrapArchive } = await bootstrapModule();
  await assert.rejects(
    createBootstrapArchive({ ...fixture, repositoryRoot: fixture.root }),
    /clean.*source|source.*clean/i,
  );
  assert.equal(
    await fs.readFile(path.join(fixture.root, "source.txt"), "utf8"),
    "reviewed source\n",
  );
  await assert.rejects(fs.stat(fixture.destination), { code: "ENOENT" });
});
