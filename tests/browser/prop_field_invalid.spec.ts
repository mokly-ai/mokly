/**
 * The invalid state of a prop field in the shell stylesheet, which bundles
 * the `@mokly/ui` rules: the field frames an invalid control's border with
 * the danger ink, as the palette contract asks, and a valid control keeps the
 * control edge.
 */

import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { renderWithShellStyles } from "./shell_styles_page.js";

/** The Light palette's danger ink and control edge. */
const DANGER_INK = "rgb(150, 67, 52)";
const CONTROL_EDGE = "rgb(134, 142, 136)";

test.use({ colorScheme: "light" });

test("an invalid number field and select draw the danger ink, and a valid field keeps the control edge", async ({
  page,
}) => {
  await renderWithShellStyles(
    page,
    new URL("./prop_field_forms.tsx", import.meta.url),
  );
  await expect(page.getByRole("textbox", { name: "label" })).toHaveCSS(
    "border-top-color",
    CONTROL_EDGE,
  );
  for (const control of [
    page.getByRole("spinbutton", { name: "cornerRadius" }),
    page.getByRole("combobox", { name: "emphasis" }),
  ]) {
    await expect(control).toHaveAttribute("aria-invalid", "true");
    await expect(control).toHaveCSS("border-top-color", DANGER_INK);
  }
});
