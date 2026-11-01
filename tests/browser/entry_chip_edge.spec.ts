/**
 * The edge of a chip in the shell stylesheet, which bundles the `@mokly/ui`
 * rules. An entry chip links to an entry, so it is a control and draws the
 * control edge, as the palette contract asks. A resting tag chip keeps its
 * hairline, one of the contract's named exceptions.
 */

import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { renderWithShellStyles } from "./shell_styles_page.js";

/** The Light palette's control edge and decorative hairline. */
const CONTROL_EDGE = "rgb(134, 142, 136)";
const HAIRLINE = "rgb(227, 229, 224)";

test.use({ colorScheme: "light" });

test("use-case and screen entry chips draw the control edge, and a resting tag chip keeps its hairline", async ({
  page,
}) => {
  await renderWithShellStyles(
    page,
    new URL("./entry_chip_forms.tsx", import.meta.url),
  );
  for (const name of ["Example tour", "Welcome"])
    await expect(page.getByRole("link", { name })).toHaveCSS(
      "border-top-color",
      CONTROL_EDGE,
    );
  await expect(page.getByRole("link", { name: "forms" })).toHaveCSS(
    "border-top-color",
    HAIRLINE,
  );
});
