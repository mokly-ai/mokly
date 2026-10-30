/**
 * The tag button of the catalogue search in the shell stylesheet, which
 * bundles the `@mokly/ui` rules: its button and its link take the pointer and
 * the hover fill, and the picture of a static depiction keeps its resting
 * look, because it acts on nothing.
 */

import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { renderWithShellStyles } from "./shell_styles_page.js";

/** The Light palette's hover fill of the button, and its inks. */
const HOVER_FILL = "rgb(227, 229, 224)";
const HOVER_INK = "rgb(74, 79, 77)";
const RESTING_INK = "rgb(103, 110, 106)";
const NO_FILL = "rgba(0, 0, 0, 0)";

test.use({ colorScheme: "light" });

test("the tag button's picture keeps its resting look, while its button and link take the pointer and the hover fill", async ({
  page,
}) => {
  await renderWithShellStyles(
    page,
    new URL("./tag_picker_forms.tsx", import.meta.url),
  );
  for (const control of [
    page.getByRole("button", { name: "Filter by tag" }),
    page.getByRole("link", { name: "Filter by tag" }),
  ]) {
    await expect(control).toHaveCSS("cursor", "pointer");
    await control.hover();
    await expect(control).toHaveCSS("background-color", HOVER_FILL);
    await expect(control).toHaveCSS("color", HOVER_INK);
  }

  // A picture takes no cursor of its own, so the arrow shows over its glyph.
  const picture = page.getByRole("img", { name: "Filter by tag" });
  await expect(picture).toHaveCSS("cursor", "auto");
  await picture.hover();
  await expect(picture).toHaveCSS("background-color", NO_FILL);
  await expect(picture).toHaveCSS("color", RESTING_INK);
});
