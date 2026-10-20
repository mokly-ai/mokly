/**
 * A copy whose catalogue rendered Light and Dark at the branch point and
 * renders Light only now. Its removed screens keep their dark renders, so the
 * shell still offers Dark, while the current Payment terms document has a
 * light page only. Under Dark a quiet band above the pane names that fallback,
 * as `design/browse/appearance/states/light-only-current` depicts.
 */

import {
  addLightOnlyCurrentSources,
  lightOnlyPaths as paths,
} from "../helpers/light_only_sources.js";

import { additionsCopyTest } from "./additions_copy_test.js";
import { expectLightOnlyDocumentBand } from "./light_only_band.js";

const test = additionsCopyTest(
  "browser-light-only-current",
  addLightOnlyCurrentSources,
);

for (const width of [1280, 390])
  test(`${width}px: a current light-only document names its light page in a band under Dark`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/view/${paths.currentDocument}/`);
    await expectLightOnlyDocumentBand(page, paths.currentDocument, width);
  });
