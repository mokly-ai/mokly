/**
 * A host's accent in the shell stylesheet, which bundles the `@mokly/ui`
 * rules: the three public accent properties that a host element sets reach
 * the package components of a viewer root inside it in every appearance, and
 * a root without such a host paints the accent of its own appearance.
 */

import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { renderWithShellStyles } from "./shell_styles_page.js";

/** The accent, the ink on it, and the soft fill that the entry's host sets. */
const HOST = {
  accent: "rgb(12, 34, 56)",
  contrast: "rgb(255, 255, 254)",
  soft: "rgb(232, 240, 244)",
};
/** The accent defaults of the Light and the Dark palette. */
const LIGHT = {
  accent: "rgb(6, 122, 69)",
  contrast: "rgb(255, 255, 255)",
  soft: "rgb(227, 246, 236)",
};
const DARK = {
  accent: "rgb(91, 227, 160)",
  contrast: "rgb(27, 27, 30)",
  soft: "rgb(15, 42, 29)",
};

// A dark system resolves an Auto root to Dark.
test.use({ colorScheme: "dark" });

test("a host's accent colours the package components in every appearance, and each appearance keeps its own accent without one", async ({
  page,
}) => {
  await renderWithShellStyles(
    page,
    new URL("./accent_inheritance_roots.tsx", import.meta.url),
  );
  for (const [root, paint] of [
    ["Dark root in a host", HOST],
    ["Auto root in a host", HOST],
    ["Light root in a host", HOST],
    ["Dark root", DARK],
    ["Auto root", DARK],
    ["Light root", LIGHT],
  ] as const) {
    const region = page.getByRole("region", { name: root, exact: true });
    const chip = region.getByRole("button", { name: "forms" });
    const control = region.getByRole("button", {
      name: "Highlight components",
    });
    await expect(chip, root).toHaveCSS("background-color", paint.accent);
    await expect(chip, root).toHaveCSS("color", paint.contrast);
    await expect(control, root).toHaveCSS("color", paint.accent);
    await expect(control, root).toHaveCSS("background-color", paint.soft);
  }
});
