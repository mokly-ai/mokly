import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { exportCatalogue } from "../dist/export/run.js";
import { publishCatalogue } from "../dist/publish/run.js";
import type { UploadManifest } from "../dist/publish/types.js";
import { NodeGitCommandRunner } from "../dist/review/git.js";

import { derivedFixture } from "./helpers/derived_fixture.js";
import { createExportFixture } from "./helpers/export_fixture.js";
import { startFakeReceiver } from "./helpers/fake_receiver.js";
import { repositoryRoot } from "./helpers/fixture.js";
import { runPublishedCli } from "./helpers/publish_process.js";

const execute = promisify(execFile);
const token = "uncommitted-receiver-token";
const note = "This publication includes uncommitted changes.\n";

async function manifest(root: string): Promise<UploadManifest> {
  return JSON.parse(
    await fs.readFile(path.join(root, "site/mokly-upload.json"), "utf8"),
  ) as UploadManifest;
}

test("an end-to-end publish reports a clean tree and a dirty tree", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const receiver = await startFakeReceiver(context, { token });
  const publish = () =>
    runPublishedCli(fixture.root, receiver.endpoint, token, ["--no-changes"]);

  const clean = await publish();
  assert.match(clean.stdout, /^Published Mokly catalogue\. /u);
  assert.equal(clean.stdout.includes(note), false);
  assert.equal((await manifest(fixture.root)).uncommittedChanges, false);
  assert.equal(receiver.publications.size, 1);

  await fs.writeFile(path.join(fixture.root, "notes.md"), "# Local edit\n");
  const dirty = await publish();
  assert.match(
    dirty.stdout,
    /^Published Mokly catalogue\. [^\n]+\nThis publication includes uncommitted changes\.\nhttp:\/\/127\.0\.0\.1:\d+\/catalogues\/publication-2\/view\n$/u,
  );
  assert.equal((await manifest(fixture.root)).uncommittedChanges, true);
  assert.equal(receiver.dirtyPublications.length, 1);
  assert.equal(
    [...receiver.publications.values()][0]?.body["id"],
    "publication-1",
  );

  await fixture.git("checkout", "--", "notes.md");
  const replay = await publish();
  assert.equal(
    replay.stdout,
    "Mokly catalogue already published for this commit.\n" +
      `${receiver.origin}/catalogues/publication-1/view\n`,
  );
});

test("a dirty publication does not block a later clean publication", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const receiver = await startFakeReceiver(context, { token });
  await fs.writeFile(path.join(fixture.root, "draft.md"), "Untracked\n");
  const dirty = await runPublishedCli(fixture.root, receiver.endpoint, token);
  assert.ok(dirty.stdout.includes(note));
  assert.equal(receiver.publications.size, 0);

  await fs.rm(path.join(fixture.root, "draft.md"));
  const clean = await runPublishedCli(fixture.root, receiver.endpoint, token);
  assert.match(clean.stdout, /^Published Mokly catalogue\. /u);
  assert.equal(clean.stdout.includes(note), false);
  assert.equal(
    [...receiver.publications.values()][0]?.body["id"],
    "publication-2",
  );
});

test("rich output adds the same line for a dirty publication", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const receiver = await startFakeReceiver(context, { token });
  await fs.writeFile(path.join(fixture.root, "draft.md"), "Untracked\n");
  const { stdout, stderr } = await execute(
    process.execPath,
    [
      path.join(repositoryRoot, "dist/cli/bin.js"),
      "publish",
      `--endpoint=${receiver.endpoint}`,
      `--token=${token}`,
      "--repository=github.com/sample/catalogue",
      "--out=site",
      "--no-changes",
    ],
    { cwd: fixture.root, env: { ...process.env, MOKLY_OUTPUT: "rich" } },
  );
  assert.match(
    stdout,
    /✔ Published Mokly catalogue · [^\n]+ \([^\n]+\)\nThis publication includes uncommitted changes\.\nhttp:\/\/127\.0\.0\.1:\d+\/catalogues\/publication-1\/view\n$/u,
  );
  assert.equal(stderr, "");
});

test("a change made during export fails the publish before Plan", async (context) => {
  for (const direction of ["appears", "disappears"] as const) {
    const fixture = await createExportFixture();
    context.after(() => fixture.close());
    const receiver = await startFakeReceiver(context, { token });
    const draft = path.join(fixture.root, "draft.md");
    if (direction === "disappears") await fs.writeFile(draft, "Draft\n");
    await assert.rejects(
      publishCatalogue(
        fixture.config,
        {
          endpoint: receiver.endpoint,
          token,
          repository: "github.com/sample/catalogue",
          out: "site",
          noChanges: true,
        },
        "1.2.3",
        {},
        {
          git: new NodeGitCommandRunner(fixture.root),
          export: async (config, options) => {
            const result = await exportCatalogue(config, options);
            if (direction === "appears") await fs.writeFile(draft, "Draft\n");
            else await fs.rm(draft);
            return result;
          },
          fetch,
          now: () => new Date(),
          random: () => 0,
          sleep: async () => undefined,
        },
      ),
      /\[mokly\/git-failed\] Uncommitted changes appeared or disappeared during export\./u,
      direction,
    );
    assert.equal(receiver.requests.length, 0, direction);
  }
});

test("derived generated files that Mokly owns never count", async (context) => {
  const fixture = await derivedFixture(context);
  await fs.writeFile(path.join(fixture.root, ".gitignore"), ".mokly-cache/\n");
  await fixture.git("commit", "-qam", "test: track no generated rules");
  const receiver = await startFakeReceiver(context, { token });
  const publish = () =>
    runPublishedCli(fixture.root, receiver.endpoint, token, ["--no-changes"]);
  const clean = await publish();
  assert.equal(clean.stdout.includes(note), false);
  assert.equal((await manifest(fixture.root)).uncommittedChanges, false);
  const untracked = (
    await fixture.git("status", "--porcelain", "--untracked-files=all")
  ).stdout;
  assert.match(untracked, /mockups\/mokly-manifest\.json/u);

  await fs.writeFile(path.join(fixture.mockupsDir, "theme.css"), "a{}\n");
  const dirty = await publish();
  assert.ok(dirty.stdout.includes(note));
  assert.equal((await manifest(fixture.root)).uncommittedChanges, true);
});
