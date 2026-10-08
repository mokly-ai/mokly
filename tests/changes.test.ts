import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { parseArguments } from "../dist/cli/arguments.js";
import { HELP } from "../dist/cli/help.js";
import { loadConfig } from "../dist/config/load.js";
import { changedManifestPaths } from "../dist/registry/changed_paths.js";
import { serve } from "../dist/server/serve.js";
import { viewRoute } from "../packages/viewer/dist/data.js";
import type { ReviewResult } from "../packages/viewer/dist/review/types.js";

import { entryAt } from "./helpers/catalogue_selection.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import { screenVariantEntrySource } from "./helpers/screen_variant_fixture.js";
import { waitForClassifiedCount } from "./helpers/watched_catalogue.js";

test("review stays internal and output options belong only to export", () => {
  assert.throws(() => parseArguments(["review"]), /unknown command: review/);
  assert.throws(
    () => parseArguments(["serve", "--out", "report"]),
    /--out belongs to export/,
  );
  assert.doesNotMatch(HELP, /mokly review/);
  assert.equal(parseArguments(["serve", "--base", "HEAD"]).base, "HEAD");
});

test("shared inputs require rendered impact to include screens in Changes", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const { manifest } = await compileCatalogue(config);
  const withShared = {
    ...config,
    review: { ...config.review, sharedImpact: ["theme/**"] },
  };
  assert.deepEqual(
    changedManifestPaths(manifest, manifest, withShared, ["theme/colors.css"]),
    [],
  );
});

test("changing only a screen variant parent marks its id changed", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const { manifest } = await compileCatalogue(config);
  const parent = entryAt(manifest, "home", "screen");
  const variant = {
    ...structuredClone(parent),
    path: "home/empty",
    useCasePaths: [],
    variantOf: "home",
  };
  const base = { ...manifest, entries: [...manifest.entries, variant] };
  const current = {
    ...base,
    entries: base.entries.map((entry) =>
      entry.path === variant.path ? { ...entry, variantOf: "details" } : entry,
    ),
  };

  assert.deepEqual(changedManifestPaths(current, base, config, []), [
    variant.path,
  ]);
});

test("a material variant edit marks only the variant route", async (t) => {
  const fixture = await createFixture(screenVariantEntrySource());
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const { manifest } = await compileCatalogue(config);
  const variant = entryAt(manifest, "home/empty", "screen");

  assert.deepEqual(
    changedManifestPaths(manifest, manifest, config, [
      `mockups/mokly-generated/${viewRoute(variant.path, "mobile", "light")}`,
    ]),
    [variant.path],
  );
});

test("renaming a parent title marks its variant through the parent projection", async (t) => {
  const fixture = await createFixture(screenVariantEntrySource());
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const { manifest } = await compileCatalogue(config);
  const parent = entryAt(manifest, "home", "screen");
  const variant = entryAt(manifest, "home/empty", "screen");
  const current = {
    ...manifest,
    entries: manifest.entries.map((entry) =>
      entry.path === parent.path ? { ...entry, title: "Renamed home" } : entry,
    ),
  };

  assert.deepEqual(changedManifestPaths(current, manifest, config, []), [
    parent.path,
    variant.path,
  ]);
});

for (const changed of ["parent", "variant"] as const)
  test(`use-case route propagation follows the exact changed screen: ${changed}`, async (t) => {
    const fixture = await createFixture(
      screenVariantEntrySource({ flowScreenId: "home/empty" }),
    );
    t.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    const { manifest } = await compileCatalogue(config);
    const screen = manifest.entries.find(
      (entry) =>
        entry.kind === "screen" &&
        entry.path === (changed === "variant" ? "home/empty" : "home"),
    );
    assert.ok(screen?.kind === "screen");

    assert.deepEqual(
      changedManifestPaths(manifest, manifest, config, [
        `mockups/mokly-generated/${viewRoute(screen.path, "mobile", "light")}`,
      ]),
      changed === "variant" ? [screen.path, "variant-flow"] : [screen.path],
    );
  });

test("Changes keeps screen comparisons lazy and has no separate Review route", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root, fixture.configPath);
  await writeCompilation(await compileCatalogue(config), config);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" });
  git("init", "--quiet");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("add", ".");
  git("commit", "--quiet", "-m", "test: baseline");
  const running = await serve(config, { base: "HEAD", port: 0, watch: false });
  try {
    await waitForClassifiedCount(running.url, 0);
    const page = await (await fetch(`${running.url}/view/home/`)).text();
    assert.doesNotMatch(page, /href="\/review"|Mokly modes/);
    assert.match(page, /Changes/);
    assert.match(page, /data-diff-mode="current"/);
    assert.match(page, /data-diff-mode="overlay"/);
    assert.equal(fs.existsSync(config.review.outDir), false);
    assert.equal((await fetch(`${running.url}/review`)).status, 404);
    assert.equal(fs.existsSync(config.review.outDir), false);
    const response = await fetch(
      `${running.url}/mokly-viewer/diffs/review.json`,
    );
    assert.equal(response.status, 200);
    const comparison = (await response.json()) as ReviewResult;
    assert.equal(
      comparison.screens.find((screen) => screen.path === "home")?.state,
      "unchanged",
    );
    assert.equal(
      fs.existsSync(path.join(config.review.outDir, "index.html")),
      false,
    );
    const view = comparison.screens[0]?.views[0];
    assert.ok(view);
    const screen = comparison.screens[0]!;
    const snapshot = await fetch(
      new URL(
        `snapshots/before/mokly-generated/${viewRoute(screen.path, view.viewport, view.colorScheme)}`,
        response.url,
      ),
    );
    assert.equal(snapshot.status, 200);
    assert.doesNotMatch(await snapshot.text(), /data-mokly-update-version/);
  } finally {
    await running.close();
  }
});
