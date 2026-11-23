/**
 * A current light-only document in Serve. A watched configuration edit drops
 * Dark from the catalogue. The removed entries keep their dark renders from
 * the base, so the shell still offers Dark, while the current Terms document
 * has a light page only. Under Dark the reading frame's label names it on the
 * canvas, and a quiet band above the pane names it in the narrow layout.
 */

import fs from "node:fs/promises";
import path from "node:path";

import type { Page } from "@playwright/test";

import {
  expectLightOnlyDocumentBand,
  expectLightOnlyDocumentLabel,
} from "./light_only_band.js";
import type { serveComparisonCatalogue } from "./serve_comparison_fixture.js";
import { test } from "./serve_comparison_test.js";

/** The private Changes catalogue of one test. */
type Changes = Awaited<ReturnType<typeof serveComparisonCatalogue>>;

/** Drop Dark from the catalogue, then open the Terms document at a width. */
async function openLightOnlyTerms(
  page: Page,
  changes: Changes,
  width: number,
): Promise<string> {
  const terms = changes.paths.currentDocument;
  const config = JSON.parse(
    await fs.readFile(path.join(changes.root, "mokly.config.json"), "utf8"),
  ) as object;
  await changes.edit(
    "mokly.config.json",
    JSON.stringify({ ...config, colorSchemes: ["light"] }),
    (index) =>
      index.documents
        .find((entry) => entry.path === terms)
        ?.colorSchemes.join() === "light",
  );
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/view/${terms}/`);
  return terms;
}

test("1280px: a current light-only document names its light page in its label under Dark", async ({
  page,
  changes,
}) => {
  const terms = await openLightOnlyTerms(page, changes, 1280);
  await expectLightOnlyDocumentLabel(page, terms, "terms.md");
});

test("390px: a current light-only document names its light page in a band under Dark", async ({
  page,
  changes,
}) => {
  const terms = await openLightOnlyTerms(page, changes, 390);
  await expectLightOnlyDocumentBand(page, terms, 390);
});
