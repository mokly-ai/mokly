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
} from "../dist/export/ownership.js";
import { exportCatalogue } from "../dist/export/run.js";
import { bundleUpload } from "../dist/publish/bundle.js";

import {
  createRemovedDeliveryFixture,
  REMOVED_BASELINE_IMAGE_BYTES,
} from "./helpers/removed_delivery_fixture.js";
import {
  archiveNames,
  readArtifact,
} from "./removed_preview_delivery_fixture.js";

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
    ({ entry }) => entry.id === "removed-page",
  );
  const screen = model.removedEntries.find(
    ({ entry }) => entry.id === "removed-screen",
  );
  assert.deepEqual(screen?.preview, { kind: "screen" });
  assert.ok(page?.preview?.kind === "page");
  for (const removed of [page, screen])
    assert.deepEqual(removed?.entry.navPath, [
      "Fixture",
      "Deleted archive",
      "Deleted section",
    ]);
  assert.notEqual(fixture.baseCommit, fixture.branchEditCommit);
  const generationRoot = path.posix.dirname(model.comparisonUrl!);
  const pagePath = `${generationRoot}/pages/removed-page.json`;
  assert.equal(pagePath, `${generationRoot}/pages/removed-page.json`);
  const preview = parseRemovedPagePreview(
    JSON.parse(await fs.readFile(path.join(fixture.output, pagePath), "utf8")),
  );
  assert.equal(preview.baseCommit, fixture.baseCommit);
  assert.equal(preview.id, "removed-page");
  const pageDocument = `snapshots/before/mokly-generated/${entryRoute("page", preview.id)}`;
  const document = await fs.readFile(
    path.join(fixture.output, generationRoot, pageDocument),
    "utf8",
  );
  assert.match(document, /Previous page/);
  assert.doesNotMatch(document, /Branch edit/);
  for (const name of [
    pagePath,
    `${generationRoot}/snapshots/before/mokly-generated/pages/removed-page.html`,
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
    .find(({ id }) => id === "removed-screen")
    ?.views.find(({ viewport }) => viewport === "desktop");
  assert.ok(desktop);
  const screenDocument = await fs.readFile(
    path.join(
      fixture.output,
      generationRoot,
      `snapshots/before/mokly-generated/${viewRoute("screen", "removed-screen", desktop.viewport, desktop.colorScheme)}`,
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
