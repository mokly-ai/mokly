import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { readCatalogue } from "@mokly/viewer";
import {
  entryRoute,
  parseRemovedPagePreview,
  parseReviewResult,
  viewRoute,
} from "@mokly/viewer/data";

import { assertPublishedPagePreview } from "./helpers/published_preview.js";
import {
  createRemovedDeliveryFixture,
  prepareRemovedPreviewEntrypoint,
} from "./helpers/removed_delivery_fixture.js";

const execute = promisify(execFile);

test("the npm preview entrypoint advertises a removed page's packaged bytes", async (t) => {
  const fixture = await createRemovedDeliveryFixture();
  t.after(() => fixture.close());
  const baseCommit = await prepareRemovedPreviewEntrypoint(fixture);
  const output = path.join(fixture.root, ".context/entrypoint");
  await execute(
    "npm",
    [
      "run",
      "preview:build",
      "--",
      "--include-changes",
      "--base",
      "origin/main",
      "--out",
      output,
    ],
    { cwd: fixture.root },
  );
  const model = readCatalogue(
    JSON.parse(
      await fs.readFile(path.join(output, "__mokly/catalogue.json"), "utf8"),
    ),
  );
  const page = model.removedEntries.find(
    ({ entry }) =>
      entry.path === "fixture/deleted-archive/deleted-section/removed-page",
  );
  assert.ok(page?.preview?.kind === "page");
  await assertPublishedPagePreview(output, page.preview, page.entry.path);
  assert.deepEqual(page.folderTitles, [
    "Fixture",
    "Deleted archive",
    "Deleted section",
  ]);
  const preview = parseRemovedPagePreview(
    JSON.parse(
      await fs.readFile(
        path.join(
          output,
          path.posix.dirname(model.comparisonUrl!),
          "previews/fixture/deleted-archive/deleted-section/removed-page/index.json",
        ),
        "utf8",
      ),
    ),
  );
  assert.equal(preview.baseCommit, baseCommit);
  const generation = path.posix.dirname(model.comparisonUrl!);
  const document = await fs.readFile(
    path.join(
      output,
      generation,
      `snapshots/before/${entryRoute(preview.path)}`,
    ),
    "utf8",
  );
  assert.match(document, /Previous page/);
  assert.doesNotMatch(document, /Branch edit/);
  assert.equal(
    await fs.readFile(
      path.join(output, generation, "snapshots/before/assets/nested.css"),
      "utf8",
    ),
    "main { color: rebeccapurple; }",
  );
  const review = parseReviewResult(
    JSON.parse(
      await fs.readFile(path.join(output, model.comparisonUrl!), "utf8"),
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
      output,
      generation,
      `snapshots/before/${viewRoute("fixture/deleted-archive/deleted-section/removed-screen", desktop.viewport, desktop.colorScheme)}`,
    ),
    "utf8",
  );
  assert.match(screenDocument, /Previous desktop screen/);
  assert.doesNotMatch(screenDocument, /Branch edit/);

  const currentOutput = path.join(fixture.root, ".context/current-entrypoint");
  await execute("npm", ["run", "preview:build", "--", "--out", currentOutput], {
    cwd: fixture.root,
  });
  const current = readCatalogue(
    JSON.parse(
      await fs.readFile(
        path.join(currentOutput, "__mokly/catalogue.json"),
        "utf8",
      ),
    ),
  );
  assert.equal(current.comparisonUrl, null);
  assert.deepEqual(current.removedEntries, []);
  await assert.rejects(fs.access(path.join(currentOutput, "__mokly/diffs")));
});
