import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readCatalogue } from "@mokly/viewer";
import {
  entryRoute,
  parseRemovedPagePreview,
  parseReviewResult,
  viewRoute,
} from "@mokly/viewer/data";

import {
  EXPORT_MARKER,
  ownedEntries,
  parseExportOwnership,
} from "../packages/mokly/dist/export/ownership.js";
import { exportCatalogue } from "../packages/mokly/dist/export/run.js";
import { bundleUpload } from "../packages/mokly/dist/publish/bundle.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import { assertPublishedPagePreview } from "./helpers/published_preview.js";
import {
  archiveNames,
  readArtifact,
} from "./helpers/removed_delivery_archive.js";
import {
  createRemovedDeliveryFixture,
  REMOVED_BASELINE_IMAGE_BYTES,
} from "./helpers/removed_delivery_fixture.js";

test("Changes export packages removed previews into every delivery boundary", async (t) => {
  const fixture = await createRemovedDeliveryFixture();
  t.after(() => fixture.close());
  let captured = new Map<string, Buffer>();
  const result = await exportCatalogue(fixture.config, {
    base: "origin/main",
    outDir: "site",
    capture: async (files) => {
      captured = new Map(
        [...files].map(([name, bytes]) => [name, Buffer.from(bytes)]),
      );
    },
  });
  assert.ok(result.comparisonUrl);
  const model = readCatalogue(
    JSON.parse(
      await fs.readFile(
        path.join(fixture.output, "__mokly/catalogue.json"),
        "utf8",
      ),
    ),
  );
  const page = model.removedEntries.find(
    ({ entry }) =>
      entry.path === "fixture/deleted-archive/deleted-section/removed-page",
  );
  const screen = model.removedEntries.find(
    ({ entry }) =>
      entry.path === "fixture/deleted-archive/deleted-section/removed-screen",
  );
  assert.deepEqual(screen?.preview, { kind: "screen" });
  assert.ok(page?.preview?.kind === "page");
  for (const removed of [page, screen])
    assert.deepEqual(removed?.folderTitles, [
      "Fixture",
      "Deleted archive",
      "Deleted section",
    ]);
  assert.notEqual(fixture.baseCommit, fixture.branchEditCommit);
  const generationRoot = path.posix.dirname(model.comparisonUrl!);
  const pagePath = `${generationRoot}/previews/fixture/deleted-archive/deleted-section/removed-page/index.json`;
  assert.equal(
    pagePath,
    `${generationRoot}/previews/fixture/deleted-archive/deleted-section/removed-page/index.json`,
  );
  const preview = parseRemovedPagePreview(
    JSON.parse(await fs.readFile(path.join(fixture.output, pagePath), "utf8")),
  );
  assert.equal(preview.baseCommit, fixture.baseCommit);
  assert.equal(
    preview.path,
    "fixture/deleted-archive/deleted-section/removed-page",
  );
  const pageDocument = `snapshots/before/${entryRoute(preview.path)}`;
  const document = await fs.readFile(
    path.join(fixture.output, generationRoot, pageDocument),
    "utf8",
  );
  assert.match(document, /Previous page/);
  assert.doesNotMatch(document, /Branch edit/);
  for (const name of [
    pagePath,
    `${generationRoot}/snapshots/before/fixture/deleted-archive/deleted-section/removed-page/index.html`,
    `${generationRoot}/snapshots/before/assets/page.css`,
    `${generationRoot}/snapshots/before/assets/nested.css`,
    `${generationRoot}/snapshots/before/assets/past.png`,
  ]) {
    assert.ok(captured.has(name), name);
    await fs.access(path.join(fixture.output, name));
  }
  assert.deepEqual(
    await fs.readFile(
      path.join(
        fixture.output,
        `${generationRoot}/snapshots/before/assets/past.png`,
      ),
    ),
    REMOVED_BASELINE_IMAGE_BYTES,
  );
  assert.equal(
    await fs.readFile(
      path.join(
        fixture.output,
        `${generationRoot}/snapshots/before/assets/nested.css`,
      ),
      "utf8",
    ),
    "main { color: rebeccapurple; }",
  );
  const review = parseReviewResult(
    JSON.parse(
      await fs.readFile(
        path.join(fixture.output, result.comparisonUrl),
        "utf8",
      ),
    ),
  );
  const desktop = review.screens
    .find(
      ({ path }) =>
        path === "fixture/deleted-archive/deleted-section/removed-screen",
    )
    ?.views.find(({ viewport }) => viewport === "desktop");
  assert.ok(desktop);
  const screenDocument = await fs.readFile(
    path.join(
      fixture.output,
      generationRoot,
      `snapshots/before/${viewRoute("fixture/deleted-archive/deleted-section/removed-screen", desktop.viewport, desktop.colorScheme)}`,
    ),
    "utf8",
  );
  assert.match(screenDocument, /Previous desktop screen/);
  assert.doesNotMatch(screenDocument, /Branch edit/);
  const ownership = parseExportOwnership(
    await fs.readFile(path.join(fixture.output, EXPORT_MARKER), "utf8"),
  );
  assert.equal(ownership.kind, "valid");
  if (ownership.kind !== "valid") assert.fail("expected valid ownership");
  const ownedPaths = ownership.value.files.map(({ path: name }) => name);
  assert.ok(ownedPaths.includes(pagePath));
  assert.ok(
    ownedPaths.includes(`${generationRoot}/snapshots/before/assets/past.png`),
  );
  const archived = await archiveNames(await bundleUpload(captured));
  assert.ok(archived.has(pagePath));
  assert.ok(archived.has(`${generationRoot}/snapshots/before/assets/past.png`));
});

test("current-only export replaces Changes without Git or historical files", async (t) => {
  const fixture = await createRemovedDeliveryFixture();
  t.after(() => fixture.close());
  await exportCatalogue(fixture.config, {
    base: "origin/main",
    outDir: "site",
  });
  await fs.rm(path.join(fixture.root, ".git"), { recursive: true });
  const result = await exportCatalogue(fixture.config, {
    noChanges: true,
    outDir: "site",
  });
  assert.equal(result.comparisonUrl, null);
  assert.ok(
    (await ownedEntries(fixture.output)).files.every(
      (name) => !name.startsWith("__mokly/diffs/"),
    ),
  );
  const model = readCatalogue(
    JSON.parse(
      await fs.readFile(
        path.join(fixture.output, "__mokly/catalogue.json"),
        "utf8",
      ),
    ),
  );
  assert.equal(model.comparisonUrl, null);
  assert.deepEqual(model.removedEntries, []);
});

test("an incomplete page closure preserves the previous export", async (t) => {
  const fixture = await createRemovedDeliveryFixture();
  t.after(() => fixture.close());
  await exportCatalogue(fixture.config, {
    noChanges: true,
    outDir: "site",
  });
  const previous = await readArtifact(fixture.output);
  await fixture.git(
    "rm",
    "--cached",
    "--ignore-unmatch",
    "mockups/assets/nested.css",
  );
  await fixture.git("commit", "-qm", "test: break historical closure");
  await fixture.git("update-ref", "refs/remotes/origin/main", "HEAD");
  await assert.rejects(
    exportCatalogue(fixture.config, {
      base: "origin/main",
      outDir: "site",
    }),
    /unavailable|resource|snapshot/i,
  );
  assert.deepEqual(await readArtifact(fixture.output), previous);
});

test("repository publication packages previews and default replacement removes them", async (t) => {
  const fixture = await createRemovedDeliveryFixture();
  t.after(() => fixture.close());
  const output = path.join(fixture.root, ".context/published");
  const originalFetch = globalThis.fetch;
  const requests: { method: string; url: string }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (...args: Parameters<typeof originalFetch>) => {
      requests.push({
        method:
          args[0] instanceof Request
            ? args[0].method
            : (args[1]?.method ?? "GET"),
        url: args[0] instanceof Request ? args[0].url : String(args[0]),
      });
      return originalFetch(...args);
    },
  );
  await buildPreview(fixture.config, output, {
    base: "origin/main",
    includeChanges: true,
  });
  const withChanges = readCatalogue(
    JSON.parse(
      await fs.readFile(path.join(output, "__mokly/catalogue.json"), "utf8"),
    ),
  );
  const page = withChanges.removedEntries.find(
    ({ entry }) =>
      entry.path === "fixture/deleted-archive/deleted-section/removed-page",
  );
  assert.ok(page?.preview?.kind === "page");
  await assertPublishedPagePreview(output, page.preview, page.entry.path);
  await fs.access(path.join(output, "__mokly/client/react-shell.js"));
  await fs.access(
    path.join(
      output,
      path.posix.dirname(withChanges.comparisonUrl!),
      "previews/fixture/deleted-archive/deleted-section/removed-page/index.json",
    ),
  );
  await fs.access(
    path.join(
      output,
      path.posix.dirname(withChanges.comparisonUrl!),
      "snapshots/before/assets/past.png",
    ),
  );
  assert.deepEqual(
    requests.filter(({ method, url }) => {
      const request = new URL(url);
      return (
        method === "HEAD" ||
        request.searchParams.has("page") ||
        request.pathname === "/__mokly/events"
      );
    }),
    [],
  );
  await fs.rm(path.join(fixture.root, ".git"), { recursive: true });
  await buildPreview(fixture.config, output);
  assert.ok(
    (await ownedEntries(output)).files.every(
      (name) => !name.startsWith("__mokly/diffs/"),
    ),
  );
});
