/**
 * The labels of highlighted instances in the shell stylesheet, which bundles
 * the `@mokly/ui` rules: the shell's button and a static depiction's link
 * show the pointer, all three forms draw the same chip, and the picture keeps
 * the resting arrow, because it acts on nothing.
 */

import { expect, type Locator } from "@playwright/test";

import { test } from "./browser_test.js";
import { renderWithShellStyles } from "./shell_styles_page.js";

/** The computed look of a label chip, which every form shares. */
function chip(label: Locator) {
  return label.evaluate((node) => {
    const style = getComputedStyle(node);
    return [
      style.height,
      style.padding,
      style.fontSize,
      style.lineHeight,
      style.borderRadius,
      style.textDecorationLine,
    ];
  });
}

test("a label's button and link show the pointer, every form draws the same chip, and the picture keeps the arrow", async ({
  page,
}) => {
  await renderWithShellStyles(
    page,
    new URL("./highlight_label_forms.tsx", import.meta.url),
  );
  const button = page.getByRole("button", { name: "Toolbar · toolbar" });
  const link = page.getByRole("link", { name: "Action · details" });
  const picture = page.getByText("Action · welcome", { exact: true });
  await expect(button).toHaveCSS("cursor", "pointer");
  await expect(link).toHaveCSS("cursor", "pointer");
  await expect(picture).toHaveCSS("cursor", "auto");
  const look = await chip(button);
  // A fixed line height keeps the gap above the outline in every font.
  expect(look[3]).toBe("13px");
  expect(look.at(-1)).toBe("none");
  expect(await chip(link)).toEqual(look);
  expect(await chip(picture)).toEqual(look);
});
