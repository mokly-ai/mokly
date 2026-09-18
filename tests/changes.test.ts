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
import { changedManifestRoutes } from "../dist/registry/changed_routes.js";
import { serve } from "../dist/server/serve.js";
import type { ReviewResult } from "../packages/viewer/dist/review/types.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
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
    changedManifestRoutes(manifest, manifest, withShared, ["theme/colors.css"]),
    [],
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
    const page = await (
      await fetch(`${running.url}/view/screens/home.html`)
    ).text();
    assert.doesNotMatch(page, /href="\/review"|Mokly modes/);
    assert.match(page, /Changes/);
    assert.match(page, /data-diff-mode="current"/);
    assert.match(page, /data-diff-mode="overlay"/);
    assert.equal(fs.existsSync(config.review.outDir), false);
    assert.equal((await fetch(`${running.url}/review`)).status, 404);
    assert.equal(fs.existsSync(config.review.outDir), false);
    const response = await fetch(`${running.url}/__mokly/diffs/review.json`);
    assert.equal(response.status, 200);
    const comparison = (await response.json()) as ReviewResult;
    assert.equal(
      comparison.screens.find((screen) => screen.id === "home")?.state,
      "unchanged",
    );
    assert.equal(
      fs.existsSync(path.join(config.review.outDir, "index.html")),
      false,
    );
    const view = comparison.screens[0]?.views[0];
    assert.ok(view?.beforePath);
    const snapshot = await fetch(new URL(view.beforePath, response.url));
    assert.equal(snapshot.status, 200);
    assert.doesNotMatch(await snapshot.text(), /data-mokly-update-version/);
  } finally {
    await running.close();
  }
});
