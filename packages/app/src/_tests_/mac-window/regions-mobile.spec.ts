import { expect, freshEmail, open, signIn, test } from "../harness";

import {
  clearMacWindow,
  emulateMacWindow,
  expectBarRegions,
  expectBarsClearOfButtons,
} from "./regions";

test("the compact settings bar moves the window and lines up with its buttons, and its controls take clicks", async ({
  page,
}) => {
  await signIn(page, freshEmail("mac-window-layer"));
  await open(page, "/settings/account");
  const bar = page.locator(".fo-layer-bar");
  await expect(bar.getByRole("link", { name: "Settings" })).toBeVisible();
  await expectBarRegions(bar, "the compact settings bar");
  await expectBarsClearOfButtons(page, { "the compact settings bar": bar });

  // In the Mac window the bar is as high as every top bar, so the buttons
  // line up with its controls, at either edge.
  for (const edge of ["start", "end"] as const) {
    await emulateMacWindow(page, edge);
    await expect
      .poll(
        async () => (await bar.boundingBox())?.height,
        `the bar's height, buttons at the ${edge}`,
      )
      .toBe(48);
    await clearMacWindow(page);
  }
});
