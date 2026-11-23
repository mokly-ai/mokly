/**
 * Serve's selected comparisons of a JavaScript screen that imports a CSS
 * Module, whose rule also loads a PNG through `url()`. Every comparison mode
 * keeps each side's own module style and serves the image bytes.
 */

import {
  addImportedCssSources,
  importedCssPaths,
} from "../helpers/imported_css_sources.js";

import { chooseMode } from "./comparison_ui.js";
import { expectStyledPanes, importedImageSize } from "./imported_css_panes.js";
import { test } from "./serve_comparison_test.js";
import { loadComparison } from "./serve_comparison_ui.js";
import { chooseViewport } from "./workspace_actions.js";

test.use({ comparisonSources: { add: addImportedCssSources } });

test("Serve comparison panes retain CSS Modules and url assets", async ({
  page,
}) => {
  const imageSize = await importedImageSize();
  await page.goto(`/view/${importedCssPaths.screen}/`);
  await chooseViewport(page, "desktop");
  await loadComparison(page, "Overlay");
  await expectStyledPanes(page, imageSize, "Overlay");
  for (const mode of ["Difference", "Side by side"] as const) {
    await chooseMode(page, mode);
    await expectStyledPanes(page, imageSize, mode);
  }
});
