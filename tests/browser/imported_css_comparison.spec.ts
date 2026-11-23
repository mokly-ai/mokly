/**
 * A small copy with a JavaScript screen that imports a CSS Module whose rule
 * loads a PNG through `url()`. Every comparison mode keeps each side's own
 * module style and its copied image bytes in the static output.
 */

import {
  addImportedCssSources,
  importedCssPaths,
} from "../helpers/imported_css_sources.js";

import { additionsCopyTest } from "./additions_copy_test.js";
import { chooseMode } from "./comparison_ui.js";
import { expectStyledPanes, importedImageSize } from "./imported_css_panes.js";
import { chooseViewport } from "./workspace_actions.js";

const test = additionsCopyTest("browser-imported-css", addImportedCssSources);

test("static export comparison panes retain CSS Modules and url assets", async ({
  page,
}) => {
  const imageSize = await importedImageSize();
  await page.goto(`/view/${importedCssPaths.screen}/`);
  await chooseViewport(page, "desktop");
  for (const mode of ["Overlay", "Difference", "Side by side"] as const) {
    await chooseMode(page, mode);
    await expectStyledPanes(page, imageSize, mode);
  }
});
