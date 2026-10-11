import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";

import { derivedFixture } from "./helpers/derived_fixture.js";
import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";
import { startFakeReceiver } from "./helpers/fake_receiver.js";
import { validEntrySource } from "./helpers/fixture.js";
import { runPublishedCli } from "./helpers/publish_process.js";

test("a fresh committed clone publishes, then refuses a dirty checkout with no request", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await fs.writeFile(path.join(fixture.root, ".gitignore"), "ignored/\n");
  await fixture.git("add", ".gitignore");
  await fixture.git("commit", "-qm", "test: ignore local files");
  const clone = await fs.mkdtemp(
    path.join(path.dirname(fixture.root), "mokly-clean-clone-"),
  );
  context.after(() => fs.rm(clone, { recursive: true, force: true }));
  await fixture.git("clone", "-q", fixture.root, clone);
  for (const directory of [
    "ignored",
    "nested/.mokly-cache",
    "nested/.mokly-write-mokly-generated-abc123",
    "nested/.mokly-review-served-abc123",
    "nested/mokly-config-abc123",
    "nested/mokly-postcss-abc123",
  ]) {
    await fs.mkdir(path.join(clone, directory), { recursive: true });
    const name = directory.includes("mokly-config-")
      ? "config.mjs"
      : directory.includes("mokly-postcss-")
        ? "postcss.mjs"
        : "local.txt";
    await fs.writeFile(path.join(clone, directory, name), "Local\n");
  }
  const receiver = await startFakeReceiver(context);
  const result = await runPublishedCli(
    clone,
    receiver.endpoint,
    "fixture-token",
    ["--no-changes"],
  );
  assert.match(result.stdout, /^Published Mokly catalogue\./);
  assert.equal(receiver.publications.size, 1);
  const requests = receiver.requests.length;
  await fs.writeFile(path.join(clone, "notes.md"), "Changed\n");
  for (const mode of ["plain", "rich"] as const) {
    await assert.rejects(
      runPublishedCli(
        clone,
        receiver.endpoint,
        "fixture-token",
        ["--no-changes"],
        mode,
      ),
      (error: unknown) => {
        const { stderr } = error as { stderr: string };
        assert.match(stderr, /The checkout has uncommitted changes\./);
        assert.match(stderr, /\[mokly\/git-uncommitted\]/);
        assert.match(stderr, /notes\.md/);
        assert.match(
          stderr,
          /Commit, stash or ignore these files, then publish again\./,
        );
        return true;
      },
    );
  }
  assert.equal(receiver.requests.length, requests);
});

test("a fresh clone with stale committed output fails without writing generated files", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await fs.writeFile(
    fixture.entryPath,
    validEntrySource({ body: "Committed new source" }),
  );
  await fixture.git("add", "entries");
  await fixture.git("commit", "-qm", "test: stale committed output");
  const clone = await fs.mkdtemp(
    path.join(path.dirname(fixture.root), "mokly-stale-clone-"),
  );
  context.after(() => fs.rm(clone, { recursive: true, force: true }));
  await fixture.git("clone", "-q", fixture.root, clone);
  const generated = path.join(clone, "mockups/mokly-generated");
  const before = await directoryFiles(generated);
  const receiver = await startFakeReceiver(context);
  for (const mode of ["plain", "rich"] as const) {
    await assert.rejects(
      runPublishedCli(
        clone,
        receiver.endpoint,
        "fixture-token",
        ["--no-changes"],
        mode,
      ),
      (error: unknown) => {
        const { stderr } = error as { stderr: string };
        assert.match(stderr, /The committed generated files are out of date\./);
        assert.match(stderr, /\[mokly\/build-stale\]/);
        assert.match(stderr, /home\/index\.mobile\.html/);
        assert.match(
          stderr,
          /Run mokly build, commit the result and publish again\./,
        );
        return true;
      },
    );
  }
  assert.deepEqual(await directoryFiles(generated), before);
  assert.equal(
    (await fixture.git("-C", clone, "diff", "HEAD", "--")).stdout,
    "",
  );
  assert.equal(receiver.requests.length, 0);
});

test("publish refuses a tracked change from config evaluation during export before Plan", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await fs.writeFile(path.join(fixture.root, "unrelated.txt"), "Original\n");
  await fs.appendFile(
    fixture.configPath,
    `
import fs from "node:fs";
const key = Symbol.for("mokly.publish-checkout-test");
if (globalThis[key]) fs.writeFileSync("unrelated.txt", "Changed during export\\n");
globalThis[key] = true;
`,
  );
  await fixture.git("add", "mokly.config.ts", "unrelated.txt");
  await fixture.git(
    "commit",
    "-qm",
    "test: config changes another tracked file",
  );
  const receiver = await startFakeReceiver(context);
  await assert.rejects(
    runPublishedCli(fixture.root, receiver.endpoint, "fixture-token", [
      "--no-changes",
    ]),
    (error: unknown) => {
      const { stderr } = error as { stderr: string };
      assert.match(stderr, /\[mokly\/git-uncommitted\]/);
      assert.match(stderr, /Changes appeared during the export\./);
      assert.match(stderr, /unrelated\.txt/);
      return true;
    },
  );
  assert.equal(receiver.requests.length, 0);
});

test("derived output publishes only with Git ignore rules, even when absent", async (context) => {
  const fixture = await derivedFixture(context);
  await writeCompilation(
    await compileCatalogue(fixture.config),
    fixture.config,
  );
  const receiver = await startFakeReceiver(context);
  await runPublishedCli(fixture.root, receiver.endpoint, "fixture-token", [
    "--no-changes",
  ]);
  assert.equal(receiver.publications.size, 1);
  await fs.writeFile(path.join(fixture.root, ".gitignore"), ".mokly-cache/\n");
  await fixture.git("add", ".gitignore");
  await fixture.git("commit", "-qm", "test: remove derived output ignore rule");
  const requests = receiver.requests.length;
  for (const present of [true, false]) {
    if (!present) await fs.rm(fixture.generatedDir, { recursive: true });
    await assert.rejects(
      runPublishedCli(fixture.root, receiver.endpoint, "fixture-token", [
        "--no-changes",
      ]),
      (error: unknown) => {
        const { stderr } = error as { stderr: string };
        assert.match(stderr, /\[mokly\/git-uncommitted\]/);
        assert.match(
          stderr,
          /Add these rules to the repository's \.gitignore:/,
        );
        assert.match(stderr, /\/mockups\/mokly-generated\//);
        return true;
      },
    );
  }
  assert.equal(receiver.requests.length, requests);
});

test("derived output through a catalogue alias uses the physical Git ignore rule", async (context) => {
  const fixture = await derivedFixture(context);
  await fs.symlink("mockups", path.join(fixture.root, "catalogue"), "dir");
  await fs.writeFile(
    fixture.configPath,
    (await fs.readFile(fixture.configPath, "utf8")).replace(
      'mockupsDir: "mockups"',
      'mockupsDir: "catalogue"',
    ),
  );
  await fixture.git("add", "mokly.config.ts", "catalogue");
  await fixture.git("commit", "-qm", "test: use catalogue alias");
  const receiver = await startFakeReceiver(context);
  await runPublishedCli(fixture.root, receiver.endpoint, "fixture-token", [
    "--no-changes",
  ]);
  assert.equal(receiver.publications.size, 1);
});

test("a clean SHA-256 repository publishes its committed generation", async (context) => {
  const fixture = await createExportFixture(undefined, {
    gitObjectFormat: "sha256",
  });
  context.after(() => fixture.close());
  const receiver = await startFakeReceiver(context);
  await runPublishedCli(fixture.root, receiver.endpoint, "fixture-token", [
    "--no-changes",
  ]);
  assert.equal(receiver.plans[0]!.manifest.headSha.length, 64);
  assert.equal(receiver.publications.size, 1);
});

test("a committed catalogue scoped below the Git root publishes current-only output", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await fs.mkdir(path.join(fixture.root, "catalogue"));
  await fixture.git(
    "mv",
    "entries",
    "mockups",
    "mokly.config.ts",
    "notes.md",
    "catalogue/",
  );
  await fixture.git("commit", "-qm", "test: scope catalogue below Git root");
  const receiver = await startFakeReceiver(context);
  await runPublishedCli(fixture.root, receiver.endpoint, "fixture-token", [
    "--config",
    "catalogue/mokly.config.ts",
    "--no-changes",
  ]);
  assert.equal(
    receiver.plans[0]!.manifest.configPath,
    "catalogue/mokly.config.ts",
  );
  assert.equal(receiver.publications.size, 1);
});

test("derived ignore guidance escapes Git pattern characters", async (context) => {
  const fixture = await derivedFixture(context);
  await fs.rename(fixture.mockupsDir, path.join(fixture.root, "mockups[one]"));
  await fs.writeFile(
    fixture.configPath,
    (await fs.readFile(fixture.configPath, "utf8")).replace(
      'mockupsDir: "mockups"',
      'mockupsDir: "mockups[one]"',
    ),
  );
  await fixture.git("add", "mokly.config.ts");
  await fixture.git(
    "commit",
    "-qm",
    "test: use literal Git pattern characters",
  );
  const receiver = await startFakeReceiver(context);
  const options = ["--no-changes"];
  await assert.rejects(
    runPublishedCli(fixture.root, receiver.endpoint, "fixture-token", options),
    (error: unknown) => {
      assert.ok(
        (error as { stderr: string }).stderr.includes(
          "/mockups\\[one\\]/mokly-generated/",
        ),
      );
      return true;
    },
  );
  assert.equal(receiver.requests.length, 0);
  await fs.appendFile(
    path.join(fixture.root, ".gitignore"),
    "/mockups\\[one\\]/mokly-generated/\n",
  );
  await fixture.git("add", ".gitignore");
  await fixture.git("commit", "-qm", "test: apply suggested ignore rule");
  await runPublishedCli(
    fixture.root,
    receiver.endpoint,
    "fixture-token",
    options,
  );
  assert.equal(receiver.publications.size, 1);
});
