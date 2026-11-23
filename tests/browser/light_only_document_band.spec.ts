/**
 * A copy whose catalogue rendered Light and Dark at the branch point and
 * renders Light only now. Its removed screens keep their dark renders, so the
 * shell still offers Dark, while the current Payment terms document has a
 * light page only. Under Dark the reading frame's label names that fallback
 * on the canvas, and a quiet band above the pane names it in the narrow
 * layout, as `design/browse/appearance/states/light-only-current` depicts.
 */

import {
  addLightOnlyCurrentSources,
  lightOnlyPaths as paths,
} from "../helpers/light_only_sources.js";

import { additionsCopyTest } from "./additions_copy_test.js";
import {
  expectLightOnlyDocumentBand,
  expectLightOnlyDocumentLabel,
} from "./light_only_band.js";

const test = additionsCopyTest(
  "browser-light-only-current",
  addLightOnlyCurrentSources,
);

test("1280px: a current light-only document names its light page in its label under Dark", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/view/${paths.currentDocument}/`);
  await expectLightOnlyDocumentLabel(
    page,
    paths.currentDocument,
    "payment-terms.md",
  );
});

test("390px: a current light-only document names its light page in a band under Dark", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`/view/${paths.currentDocument}/`);
  await expectLightOnlyDocumentBand(page, paths.currentDocument, 390);
});
