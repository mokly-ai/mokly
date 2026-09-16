import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { loadConfig } from "../dist/config/load.js";
import { readManifest } from "../dist/registry/manifest.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";
import { expectedStylesheetChanges } from "../scripts/large/browse.mjs";

import { generateLargeFixture } from "./fixtures/large/generate.js";
import { repositoryRoot } from "./helpers/fixture.js";

const exec = promisify(execFile);

test("large CLI rejects invalid shared stylesheet options before setup", async () => {
  for (const args of [
    ["--stylesheets", "-1"],
    ["--stylesheets", "1.5"],
    ["--stylesheets"],
    ["--stylesheet-share", "1.1"],
    ["--stylesheet-share", "-0.1"],
    ["--stylesheet-share"],
  ])
    await assert.rejects(
      exec(process.execPath, ["scripts/large/cli.mjs", "generate", ...args], {
        cwd: repositoryRoot,
        timeout: 60000,
      }),
      /needs a (non-negative integer|number between 0 and 1)/,
    );
});

test(
  "large setup commits shared stylesheets before adding an unrelated rule",
  { timeout: 120000 },
  async (t) => {
    const repository = await fs.mkdtemp(
      path.join(repositoryRoot, ".context/large-setup-"),
    );
    t.after(() => fs.rm(repository, { recursive: true, force: true }));
    await fs.cp(
      path.join(repositoryRoot, "scripts/large"),
      path.join(repository, "scripts/large"),
      { recursive: true },
    );
    for (const directory of ["dist", "tests"])
      await fs.symlink(
        path.join(repositoryRoot, directory),
        path.join(repository, directory),
        "junction",
      );
    const record = path.join(repository, ".context/large-1-3-1-2-0.34.json");
    const { stdout } = await exec(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/large/cli.mjs",
        "generate",
        "--areas",
        "1",
        "--screens",
        "3",
        "--rows",
        "1",
        "--stylesheets",
        "2",
        "--stylesheet-share",
        "0.34",
      ],
      { cwd: repository, timeout: 120000 },
    );
    const fixture = JSON.parse(
      stdout
        .split("\n")
        .find((line) => line.startsWith("Fixture setup "))!
        .slice("Fixture setup ".length),
    ) as { root: string };
    assert.equal(
      JSON.parse(await fs.readFile(record, "utf8")).root,
      fixture.root,
    );
    const git = (...args: string[]) =>
      exec("git", args, { cwd: fixture.root, timeout: 60000 });
    const changedPath = "mockups/assets/shared-1.css";
    assert.equal(
      (await git("diff", "--name-only", "main")).stdout.trim(),
      changedPath,
    );
    assert.equal(
      (await git("ls-files", "--others", "--exclude-standard")).stdout,
      "",
    );
    const baseline = (await git("show", `main:${changedPath}`)).stdout;
    const current = await fs.readFile(
      path.join(fixture.root, changedPath),
      "utf8",
    );
    assert.equal(
      current,
      `${baseline}.scale-unrelated-rule { outline: 1px solid rebeccapurple; }\n`,
    );
    const config = await loadConfig(fixture.root);
    const manifest = readManifest(config);
    for (const entry of manifest.entries) {
      for (const view of generatedViews(entry)) {
        const html = await fs.readFile(
          path.join(config.mockupsDir, view.path),
          "utf8",
        );
        const linked =
          entry.kind === "screen" && entry.id !== "area-1-screen-3";
        for (const id of [1, 2])
          assert.equal(html.includes(`assets/shared-${id}.css`), linked);
        assert.ok(!html.includes("scale-unrelated-rule"));
      }
    }
    const snapshot = await computeCatalogueChanges(
      config,
      "main",
      committedReviewRepository(config),
    );
    assert.deepEqual(snapshot.changedRoutes, []);
    assert.equal(snapshot.changedRoutes?.length, expectedStylesheetChanges);
    const result = snapshot.componentChanges?.result;
    assert.ok(result);
    assert.deepEqual(result.changedPaths, [changedPath]);
    assert.deepEqual(result.changes, []);
    for (const screen of result.screens)
      for (const view of screen.views)
        assert.deepEqual(
          view.excludedResources,
          screen.id === "area-1-screen-3"
            ? undefined
            : [{ path: changedPath, reason: "no-matching-rule" }],
        );
  },
);

for (const dimensions of [
  { stylesheets: 0 },
  { stylesheetShare: 0 },
  { stylesheetShare: 1 },
]) {
  test(`shared stylesheet selection handles ${JSON.stringify(dimensions)}`, async (t) => {
    const root = await fs.mkdtemp(
      path.join(repositoryRoot, ".context/large-stylesheets-"),
    );
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const fixture = await generateLargeFixture(root, {
      areas: 1,
      screens: 2,
      rows: 1,
      ...dimensions,
    });
    const config = await loadConfig(root);
    const shared = config.stylesheets
      .flatMap((rule) => rule.stylesheets)
      .filter((name) => name.includes("shared-"));
    assert.equal(
      shared.length,
      fixture.size.stylesheets * fixture.size.stylesheetShare === 0
        ? 0
        : fixture.size.stylesheets,
    );
    const files = await fs.readdir(path.join(config.mockupsDir, "assets"));
    assert.equal(
      files.filter((name) => name.startsWith("shared-")).length,
      fixture.size.stylesheets,
    );
  });
}
