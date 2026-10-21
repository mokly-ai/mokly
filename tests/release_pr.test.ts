import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { bootstrapFixture } from "./helpers/bootstrap_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);
const script = path.join(repositoryRoot, "scripts/release/check-pr.mjs");

async function releaseFixture(t: test.TestContext) {
  const fixture = await bootstrapFixture(t);
  const write = async (file: string, content: string) => {
    const destination = path.join(fixture.root, file);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, content);
  };
  const version = async (name: string, value: string) =>
    write(
      `packages/${name}/package.json`,
      JSON.stringify({ name: `@mokly/${name}`, version: value }),
    );
  const commit = async () => {
    await fixture.git("add", "-A");
    await fixture.git("commit", "-m", "test: release candidate");
    return fixture.git("rev-parse", "HEAD");
  };
  await version("mokly", "0.8.0");
  await write("packages/viewer/src/index.ts", "export const value = 1;\n");
  await write("packages/viewer/tests/viewer.test.ts", "original test\n");
  const base = await commit();
  await fixture.git("tag", "-a", "viewer-v0.1.0", "-m", "viewer release");
  const check = (comparison = base) =>
    execute(process.execPath, [script, comparison], { cwd: fixture.root });
  return { ...fixture, base, write, version, commit, check };
}

test("a CLI-only release reuses an unchanged viewer before its CLI tag exists", async (t) => {
  const fixture = await releaseFixture(t);
  await fixture.version("mokly", "0.8.1");
  await fixture.commit();
  const tags = await fixture.git("tag", "--list");
  assert.match((await fixture.check()).stdout, /Release pull request passed/);
  assert.equal(await fixture.git("tag", "--list"), tags);
  assert.equal(tags, "viewer-v0.1.0");
});

test("a paired release permits new viewer source without creating either tag", async (t) => {
  const fixture = await releaseFixture(t);
  await fixture.version("mokly", "0.8.1");
  await fixture.version("viewer", "0.1.1");
  await fixture.write("packages/viewer/src/index.ts", "new viewer\n");
  await fixture.commit();
  await fixture.check();
  assert.equal(await fixture.git("tag", "--list"), "viewer-v0.1.0");
});

test("a viewer-only release fails before any new release tag exists", async (t) => {
  const fixture = await releaseFixture(t);
  await fixture.version("viewer", "0.1.1");
  await fixture.commit();
  await assert.rejects(fixture.check(), /Release the CLI with the viewer/);
  assert.equal(await fixture.git("tag", "--list"), "viewer-v0.1.0");
});

test("CLI-only release rejects viewer changes already present on the PR base", async (t) => {
  const fixture = await releaseFixture(t);
  await fixture.write("packages/viewer/src/index.ts", "unreleased refactor\n");
  const base = await fixture.commit();
  await fixture.version("mokly", "0.8.1");
  await fixture.commit();
  await assert.rejects(
    fixture.check(base),
    /Viewer source changed since viewer-v0\.1\.0/,
  );
});

test("viewer test changes do not require a viewer release", async (t) => {
  const fixture = await releaseFixture(t);
  await fixture.version("mokly", "0.8.1");
  await fixture.write("packages/viewer/tests/viewer.test.ts", "changed test\n");
  await fixture.write("packages/viewer/tests/helpers/new.ts", "new helper\n");
  await fixture.commit();
  await fixture.check();
});

for (const change of ["add", "delete", "move into tests"] as const) {
  test(`viewer source ${change} requires a viewer release`, async (t) => {
    const fixture = await releaseFixture(t);
    await fixture.version("mokly", "0.8.1");
    const source = path.join(fixture.root, "packages/viewer/src/index.ts");
    if (change === "add")
      await fixture.write(
        "packages/viewer/src/new.css",
        ".new { color: red }\n",
      );
    else if (change === "delete") await fs.rm(source);
    else
      await fs.rename(
        source,
        path.join(fixture.root, "packages/viewer/tests/moved.ts"),
      );
    await fixture.commit();
    await assert.rejects(fixture.check(), /Viewer source changed since/);
  });
}

test("a missing viewer tag fails with a recovery action", async (t) => {
  const fixture = await releaseFixture(t);
  await fixture.git("tag", "-d", "viewer-v0.1.0");
  await fixture.version("mokly", "0.8.1");
  await fixture.commit();
  await assert.rejects(fixture.check(), /Fetch the viewer release tag/);
});
