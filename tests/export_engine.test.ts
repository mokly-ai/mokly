import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { exportCatalogue } from "../dist/export/run.js";
import type { ReviewResult } from "../packages/viewer/dist/review/types.js";

import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";

test("export builds a complete consumer catalogue with an isolated comparison", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await fs.promises.mkdir(fixture.config.review.outDir);
  await fs.promises.writeFile(
    path.join(fixture.config.review.outDir, "keep"),
    "server",
  );
  await fs.promises.writeFile(
    fixture.entryPath,
    (await fs.promises.readFile(fixture.entryPath, "utf8")).replace(
      "Home screen",
      "Changed description",
    ),
  );
  const result = await exportCatalogue(fixture.config, { outDir: "site" });
  const files = await directoryFiles(fixture.output);
  for (const name of [
    "index.html",
    "404.html",
    "view/screens/home.html",
    "id/home/index.html",
    "view/user-flows/tour.html",
    "static/screens/home.mobile.html",
  ])
    assert.ok(files.has(name), name);
  assert.ok(result.comparisonUrl);
  const review = JSON.parse(
    files.get(result.comparisonUrl.slice(1))!.toString(),
  ) as ReviewResult;
  assert.equal(review.schemaVersion, 2);
  assert.equal(review.baseRef, "origin/main");
  assert.ok(
    ![...files.keys()].some((name) =>
      /summary\.md|\.mokly-review-artifact|\.tsx$/.test(name),
    ),
  );
  assert.equal(
    await fs.promises.readFile(
      path.join(fixture.config.review.outDir, "keep"),
      "utf8",
    ),
    "server",
  );
  const next = await exportCatalogue(fixture.config, { outDir: "site" });
  assert.equal(next.comparisonUrl, result.comparisonUrl);
  assert.deepEqual(await directoryFiles(fixture.output), files);
  assert.ok(!review.changedPaths.some((name) => name.startsWith("site/")));
});

test("missing baselines and mid-export edits preserve the previous site", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await exportCatalogue(fixture.config, { outDir: "site" });
  const previous = await directoryFiles(fixture.output);
  await assert.rejects(
    exportCatalogue(fixture.config, { outDir: "site", base: "missing-ref" }),
  );
  await assert.rejects(
    exportCatalogue(fixture.config, {
      outDir: "site",
      adapter: {
        transform: async () => {
          await fs.promises.writeFile(
            fixture.entryPath,
            (await fs.promises.readFile(fixture.entryPath, "utf8")).replace(
              "Home screen",
              "Edited during export",
            ),
          );
        },
      },
    }),
    /inputs changed/,
  );
  assert.deepEqual(await directoryFiles(fixture.output), previous);
});
