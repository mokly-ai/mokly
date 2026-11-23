import { expect, type Locator, type Page } from "@playwright/test";

import { test } from "./browser_test.js";

/** The focus glow's ring: a 4px spread without blur, before any other shadow. */
const GLOW = /^(?:rgba?|color)\([^)]*\) 0px 0px 0px 4px(?:,|$)/u;

async function shadow(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).boxShadow);
}

/** Press Tab until `target` holds the focus, as a keyboard reader moves it. */
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let step = 0; step < 80; step += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement))
      return;
  }
  throw new Error("The control was not reachable with Tab");
}

test("the zoom pill's buttons and the path chip draw the focus glow", async ({
  page,
}) => {
  await page.goto("/view/example/screens/welcome/");
  const pill = page.getByRole("group", { name: "Zoom" });
  const controls = [
    // The canvas section's chip, beside the head band's own chip.
    page.locator("[data-mokly-stage]").getByRole("button", {
      name: "Copy path example/screens/welcome",
      exact: true,
    }),
    pill.getByRole("button", { name: "Zoom out", exact: true }),
    pill.getByRole("button", { name: "Zoom in", exact: true }),
    pill.getByRole("button", { name: "Fit", exact: true }),
  ];
  for (const control of controls) {
    await expect(control).toBeVisible();
    expect(await shadow(control)).not.toMatch(GLOW);
    await tabTo(page, control);
    await expect(control).toBeFocused();
    expect(await shadow(control)).toMatch(GLOW);
  }
});
