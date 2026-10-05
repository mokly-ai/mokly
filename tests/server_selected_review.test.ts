import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readCatalogueChanges } from "../dist/server/component_changes.js";
import { configuredServedReview } from "../dist/server/configured_review.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { viewRoute } from "../packages/viewer/dist/data.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("a selected comparison reuses classification and reads only its snapshot closure", async (t) => {
  const renderLog = path.join(
    repositoryRoot,
    ".context",
    `render-${randomUUID()}.log`,
  );
  t.after(() => fs.rm(renderLog, { force: true }));
  const entry = componentEntrySource({
    extra: `import { appendFileSync } from "node:fs";
function RenderProbe() { appendFileSync(${JSON.stringify(renderLog)}, "render\\n"); return null; }`,
  }).replaceAll("<main>", "<main><RenderProbe />");
  const fixture = await componentReviewFixture(
    t,
    (source) => source.replaceAll("Screen content", "Updated content"),
    entry,
  );
  const changes = await readCatalogueChanges(
    fixture.config,
    fixture.after.manifest,
    "HEAD",
    fixture.git,
    "a".repeat(40),
  );
  const reads: string[] = [];
  const git = {
    ...fixture.git,
    reader: {
      ...fixture.git.reader,
      readFileBytes: async (commit: string, route: string) => {
        reads.push(route);
        return fixture.git.reader.readFileBytes(commit, route);
      },
    },
  };
  const server = await startCatalogueServer(fixture.config, {
    base: "HEAD",
    port: 0,
    manifest: fixture.after.manifest,
    componentChanges: changes,
    review: configuredServedReview(fixture.config, "HEAD", git),
  });
  fixture.beforeRemove(() => server.close());
  assert.ok((await fs.readFile(renderLog, "utf8")).includes("render"));
  await fs.writeFile(renderLog, "");
  const unrelated = fixture.after.manifest.entries.find(
    (entry) => entry.kind === "component" && "variantOf" in entry,
  );
  assert.ok(unrelated?.kind === "component" && "variantOf" in unrelated);
  if (unrelated?.kind !== "component" || !("variantOf" in unrelated))
    throw new Error("Missing component variant");
  await fs.rm(
    path.join(
      fixture.generatedDir,
      viewRoute(unrelated.path, "mobile", "light"),
    ),
  );

  const response = await fetch(
    `${server.url}/mokly-viewer/diffs/review.json?path=home`,
  );
  assert.equal(response.status, 200, await response.clone().text());
  const result = parseReviewResult(await response.json());
  assert.equal(result.schemaVersion, 6);
  assert.deepEqual(
    result.screens.map((screen) => screen.path),
    ["home"],
  );
  if (result.schemaVersion === 6) assert.deepEqual(result.components, []);
  assert.equal(reads.length, 4);
  assert.equal(await fs.readFile(renderLog, "utf8"), "");
  assert.ok(
    reads.every((route) =>
      route.startsWith("mockups/mokly-generated/home/index."),
    ),
  );
  const desktop = result.screens[0]!.views.find(
    (view) => view.viewport === "desktop" && view.colorScheme === "light",
  )!;
  assert.match(
    await (
      await fetch(
        new URL(
          `snapshots/before/mokly-generated/${viewRoute("home", desktop.viewport, desktop.colorScheme)}`,
          response.url,
        ),
      )
    ).text(),
    /Screen content/,
  );
  assert.match(
    await (
      await fetch(
        new URL(
          `snapshots/after/mokly-generated/${viewRoute("home", desktop.viewport, desktop.colorScheme)}`,
          response.url,
        ),
      )
    ).text(),
    /Updated content/,
  );
  const cached = await fetch(
    `${server.url}/mokly-viewer/diffs/review.json?path=home`,
  );
  assert.equal(cached.url, response.url);
  assert.equal(reads.length, 4);
  const pane = new URL(
    `snapshots/after/mokly-generated/${viewRoute("home", desktop.viewport, desktop.colorScheme)}`,
    response.url,
  );
  assert.equal((await fetch(pane, { method: "HEAD" })).status, 200);
  for (const relative of [
    "summary.md",
    "snapshots/after/mokly-manifest.json",
    "snapshots/after/mokly-generated/mokly-manifest.json",
    "snapshots%2fafter%2fprivate.html",
  ])
    assert.equal((await fetch(new URL(relative, response.url))).status, 404);
  const edited = path.join(
    fixture.generatedDir,
    viewRoute("home", desktop.viewport, desktop.colorScheme),
  );
  const checked = await fs.readFile(edited, "utf8");
  await fs.writeFile(
    edited,
    checked.replace("Updated content", "Unchecked content"),
  );
  const unchanged = await fetch(
    `${server.url}/mokly-viewer/diffs/review.json?path=home&refresh=1`,
  );
  assert.equal(unchanged.status, 200);
  assert.deepEqual(
    parseReviewResult(await unchanged.json()).screens.map(
      (screen) => screen.path,
    ),
    ["home"],
  );
  assert.match(await (await fetch(pane)).text(), /Updated content/);
  server.publishUpdate({ changesStatus: "pending" });
  const pending = await fetch(
    `${server.url}/mokly-viewer/diffs/review.json?path=home`,
  );
  assert.equal(pending.status, 500);
  assert.match(await pending.text(), /not ready/);
  await fs.writeFile(edited, checked);
  server.publishUpdate({ componentChanges: changes });
  const refreshed = await fetch(
    `${server.url}/mokly-viewer/diffs/review.json?path=home`,
  );
  assert.equal(refreshed.status, 200);
  assert.notEqual(refreshed.url, response.url);
  assert.match(await (await fetch(pane)).text(), /Updated content/);
});

test("component comparison snapshots contain only the selected saved variant", async (t) => {
  const fixture = await componentReviewFixture(t, (source) =>
    source.replaceAll("Continue", "Proceed"),
  );
  const changes = await readCatalogueChanges(
    fixture.config,
    fixture.after.manifest,
    "HEAD",
    fixture.git,
    "a".repeat(40),
  );
  const server = await startCatalogueServer(fixture.config, {
    base: "HEAD",
    port: 0,
    manifest: fixture.after.manifest,
    componentChanges: changes,
    review: configuredServedReview(fixture.config, "HEAD", fixture.git),
  });
  fixture.beforeRemove(() => server.close());
  const response = await fetch(
    `${server.url}/mokly-viewer/diffs/review.json?path=action/disabled`,
  );
  assert.equal(response.status, 200, await response.clone().text());
  const result = parseReviewResult(await response.json());
  assert.equal(result.schemaVersion, 6);
  if (result.schemaVersion !== 6) return;
  assert.deepEqual(result.screens, []);
  assert.equal(result.components.length, 1);
  assert.deepEqual(
    result.components[0]!.variants.map((variant) => variant.path),
    ["action/disabled"],
  );
  const view = result.components[0]!.variants[0]!.views[0]!;
  const before = await (
    await fetch(
      new URL(
        `snapshots/before/mokly-generated/${viewRoute("action/disabled", view.viewport, view.colorScheme)}`,
        response.url,
      ),
    )
  ).text();
  const after = await (
    await fetch(
      new URL(
        `snapshots/after/mokly-generated/${viewRoute("action/disabled", view.viewport, view.colorScheme)}`,
        response.url,
      ),
    )
  ).text();
  assert.match(before, /Continue/);
  assert.match(after, /Proceed/);
  assert.match(after, /disabled/);
  for (const query of [
    "id=..%2Fprivate",
    "path=action&path=home",
    "id=action&page=removed-page",
    "route=default",
    "unknown=value",
  ])
    assert.equal(
      (await fetch(`${server.url}/mokly-viewer/diffs/review.json?${query}`))
        .status,
      404,
    );
});
