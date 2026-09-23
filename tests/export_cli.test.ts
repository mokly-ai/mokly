import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { parseArguments } from "../dist/cli/arguments.js";
import { HELP } from "../dist/cli/help.js";

import { createExportFixture } from "./helpers/export_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);
const cli = path.join(repositoryRoot, "dist/cli/bin.js");

test("export CLI requires an explicit output and rejects misplaced options", () => {
  assert.deepEqual(
    parseArguments(["export", "--out", "site", "--base", "release"]),
    {
      command: "export",
      help: false,
      version: false,
      out: "site",
      base: "release",
    },
  );
  assert.throws(() => parseArguments(["export"]), /--out is required/);
  for (const args of [
    ["export", "--out"],
    ["export", "--out", ""],
    ["export", "--out", "   "],
    ["export", "--base", "--out", "site"],
  ])
    assert.throws(() => parseArguments(args), /requires a value/);
  for (const command of ["serve", "build", "check"])
    assert.throws(
      () => parseArguments([command, "--out", "site"]),
      /--out belongs to export/,
    );
  assert.throws(
    () => parseArguments(["export", "--out", "site", "--watch"]),
    /belong to serve/,
  );
  assert.throws(
    () => parseArguments(["export", "--out", "site", "extra"]),
    /unknown option/,
  );
  assert.equal(parseArguments(["publish"]).command, "publish");
  assert.equal(parseArguments(["export", "--help"]).help, true);
  assert.match(HELP, /mokly export --out <path>/);
});

test("export help needs no consumer config or output", async () => {
  const { stdout } = await execute(
    process.execPath,
    [cli, "export", "--help"],
    { cwd: path.dirname(repositoryRoot) },
  );
  assert.match(stdout, /export/);
});

test("discovered nested invocations build before exporting and honor configured bases", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await fixture.git("branch", "release");
  const config = await fs.promises.readFile(fixture.configPath, "utf8");
  await fs.promises.writeFile(
    fixture.configPath,
    config.replace("review: {", 'review: { base: "release",'),
  );
  const source = await fs.promises.readFile(fixture.entryPath, "utf8");
  await fs.promises.writeFile(
    fixture.entryPath,
    source.replace('title: "Home"', 'title: "Published home"'),
  );
  const { stdout } = await execute(
    process.execPath,
    [cli, "export", "--out", "site"],
    { cwd: fixture.entriesDir },
  );
  assert.match(stdout, /Exported Mokly/);
  const html = await fs.promises.readFile(
    path.join(fixture.output, "view/screens/home.html"),
    "utf8",
  );
  assert.match(html, /Published home/);
  assert.match(html, /data-mokly-base="release"/);
  await execute(process.execPath, [cli, "build"], { cwd: fixture.root });
  await execute(process.execPath, [cli, "check"], { cwd: fixture.root });
  await execute(
    process.execPath,
    [cli, "export", "--out", fixture.output, "--base", "HEAD"],
    { cwd: fixture.root },
  );
  assert.match(
    await fs.promises.readFile(path.join(fixture.output, "index.html"), "utf8"),
    /data-mokly-base="HEAD"/,
  );
});

test("explicit nested configs resolve output beside the config, not the process", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const nested = path.join(fixture.root, "configuration");
  await fs.promises.mkdir(nested);
  const config = (await fs.promises.readFile(fixture.configPath, "utf8"))
    .replace('entriesDir: "entries"', 'entriesDir: "../entries"')
    .replace('mockupsDir: "mockups"', 'mockupsDir: "../mockups"')
    .replace('repoRoot: "."', 'repoRoot: ".."');
  await fs.promises.writeFile(path.join(nested, "custom.ts"), config);
  await execute(
    process.execPath,
    [cli, "export", "--config", "configuration/custom.ts", "--out", "site"],
    { cwd: fixture.root },
  );
  assert.ok(fs.existsSync(path.join(nested, "site/index.html")));
  assert.equal(fs.existsSync(fixture.output), false);
});
