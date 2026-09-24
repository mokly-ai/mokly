import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { readCatalogue } from "@mokly/viewer";
import { parseRemovedPagePreview, parseReviewResult } from "@mokly/viewer/data";

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
    ({ entry }) => entry.route === "archive/removed.html",
  );
  assert.ok(page?.preview?.kind === "page");
  await assertPublishedPagePreview(output, page.preview);
  assert.deepEqual(page.entry.navPath, [
    "Fixture",
    "Deleted archive",
    "Deleted section",
  ]);
  const preview = parseRemovedPagePreview(
    JSON.parse(await fs.readFile(path.join(output, page.preview.path), "utf8")),
  );
  assert.equal(preview.baseCommit, baseCommit);
  const generation = path.posix.dirname(
    path.posix.dirname(path.posix.dirname(page.preview.path)),
  );
  const document = await fs.readFile(
    path.join(output, generation, preview.documentPath),
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
    .find(({ route }) => route === "screens/removed.html")
    ?.views.find(({ viewport }) => viewport === "desktop");
  assert.ok(desktop?.beforePath);
  const screenDocument = await fs.readFile(
    path.join(output, generation, desktop.beforePath),
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
