import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { committedReviewRepository } from "../dist/review/repository.js";
import { computeChangedRoutes } from "../dist/server/changed.js";
import { serve } from "../dist/server/serve.js";
import type { ReviewResult } from "../packages/viewer/dist/review/types.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";
import { waitForClassifiedCount } from "./helpers/watched_catalogue.js";

const ignoredSource = validEntrySource({
  body: '<ReviewIgnore id="nav"><nav>Old navigation</nav></ReviewIgnore><p>Screen content</p>',
}).replace(
  "import { defineCollection",
  "import { ReviewIgnore, defineCollection",
);

test("Changes excludes ignored-only edits while comparisons retain their evidence", async (t) => {
  const fixture = await changedFixture(t, ignoredSource);
  await fs.writeFile(
    fixture.entryPath,
    ignoredSource.replaceAll("Old navigation", "New navigation"),
  );
  await fixture.build();
  assert.deepEqual(
    await computeChangedRoutes(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    ),
    [],
  );
  const running = await serve(fixture.config, {
    base: "HEAD",
    port: 0,
    watch: false,
  });
  t.after(() => running.close());
  const page = await waitForClassifiedCount(running.url, 0);
  assert.match(page, /class="mbk-nav-filter-count">0</);
  await assert.rejects(fs.access(fixture.config.review.outDir));
  const result = (await (
    await fetch(`${running.url}/__mokly/diffs/review.json`)
  ).json()) as ReviewResult;
  assert.equal(
    result.screens.find((s) => s.id === "home")?.state,
    "ignored-only",
  );
  assert.ok(result.ignoredImpact.some((region) => region.id === "nav"));
});

test("Changes keeps real content edits alongside ignored-region edits", async (t) => {
  const fixture = await changedFixture(t, ignoredSource);
  await fs.writeFile(
    fixture.entryPath,
    ignoredSource
      .replaceAll("Old navigation", "New navigation")
      .replaceAll("Screen content", "Changed content"),
  );
  await fixture.build();
  assert.deepEqual(
    await computeChangedRoutes(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    ),
    ["screens/home.html", "user-flows/tour.html"],
  );
});

test("dependency-only edits retain evidence without generating a review list", async (t) => {
  const fixture = await changedFixture(t);
  await fs.writeFile(path.join(fixture.root, "notes.md"), "# Edited notes\n");
  assert.deepEqual(
    await computeChangedRoutes(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    ),
    [],
  );
  const running = await serve(fixture.config, {
    base: "HEAD",
    port: 0,
    watch: false,
  });
  t.after(() => running.close());
  await assert.rejects(fs.access(fixture.config.review.outDir));
  const result = (await (
    await fetch(`${running.url}/__mokly/diffs/review.json`)
  ).json()) as ReviewResult;
  const home = result.screens.find((s) => s.id === "home");
  assert.equal(home?.state, "unchanged");
  assert.ok(home?.sharedImpact.includes("notes.md"));
});

test("Changes includes a dark-only material edit", async (t) => {
  const fixture = await changedFixture(t, validEntrySource(), {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  const file = path.join(fixture.mockupsDir, "screens/home.mobile.dark.html");
  const document = await fs.readFile(file, "utf8");
  await fs.writeFile(file, document.replaceAll(">Details<", ">Dark details<"));
  assert.deepEqual(
    await computeChangedRoutes(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    ),
    ["screens/home.html", "user-flows/tour.html"],
  );
});

test("Changes keeps material keys inside otherwise ignored shared chrome", async (t) => {
  const source = ignoredSource.replace(
    'id="nav"',
    'id="nav" materialKey={"a".repeat(64)}',
  );
  const fixture = await changedFixture(t, source);
  await fs.writeFile(
    fixture.entryPath,
    source.replace('"a".repeat(64)', '"b".repeat(64)'),
  );
  await fixture.build();
  assert.deepEqual(
    await computeChangedRoutes(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    ),
    ["screens/home.html", "user-flows/tour.html"],
  );
});

test("moving a source module preserves an unchanged review list", async (t) => {
  const fixture = await changedFixture(t);
  await fs.rename(
    fixture.entryPath,
    path.join(fixture.entriesDir, "moved.mockup.tsx"),
  );
  await fixture.build();
  assert.deepEqual(
    await computeChangedRoutes(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    ),
    [],
  );
  const running = await serve(fixture.config, {
    base: "HEAD",
    port: 0,
    watch: false,
  });
  t.after(() => running.close());
  const result = (await (
    await fetch(`${running.url}/__mokly/diffs/review.json`)
  ).json()) as ReviewResult;
  assert.ok(result.screens.every((screen) => screen.state === "unchanged"));
});

test("invalid baseline ignore markers leave the filter unavailable", async (t) => {
  const fixture = await changedFixture(t);
  const fragment = path.join(fixture.mockupsDir, "screens/home.mobile.html");
  const original = await fs.readFile(fragment, "utf8");
  await fs.writeFile(
    fragment,
    original + "<!--mokly-review-ignore:start:nav-->",
  );
  fixture.git("add", ".");
  fixture.git("commit", "-qm", "test: invalid baseline");
  await fixture.build();
  assert.equal(
    await computeChangedRoutes(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    ),
    undefined,
  );
});

test("embedding an ignored-only screen does not reintroduce it through resource impact", async (t) => {
  const source = ignoredSource.replaceAll(
    ">Detail</main>",
    '><iframe src="home.mobile.html" title="Embedded home" /></main>',
  );
  const fixture = await changedFixture(t, source);
  await fs.writeFile(
    fixture.entryPath,
    source.replaceAll("Old navigation", "New navigation"),
  );
  await fixture.build();
  assert.deepEqual(
    await computeChangedRoutes(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    ),
    [],
  );
});
