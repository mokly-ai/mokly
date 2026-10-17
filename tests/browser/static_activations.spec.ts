import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { staticActivationFixture } from "./static_activations_fixture.js";
import { staticRequests } from "./static_delivery_assertions.js";

let host: Awaited<ReturnType<typeof staticActivationFixture>>;
test.beforeAll(async () => {
  host = await staticActivationFixture();
});

for (const activation of [
  "keyboard",
  "middle",
  "modifier",
  "blank",
  "named",
] as const) {
  test(`copied ${activation} activation uses a canonical static route`, async ({
    page,
    context,
  }) => {
    const requests = staticRequests(page);
    await page.goto(`${host.url}/view/home/`);
    const frame = page.frameLocator(".mbk-frame-mobile iframe");
    const name =
      activation === "blank"
        ? "New tab"
        : activation === "named"
          ? "Named tab"
          : "Details";
    const link = frame.getByRole("link", { name, exact: true });
    if (activation === "keyboard") {
      await link.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(
        `${host.url}/view/details/?fragment=details`,
      );
      await expect(page.locator("#mb-main h2")).toHaveText("Details");
    } else {
      const opened = context.waitForEvent("page");
      await link.click({
        ...(activation === "middle" ? { button: "middle" } : {}),
        ...(activation === "modifier" ? { modifiers: ["ControlOrMeta"] } : {}),
      });
      const popup = await opened;
      await expect(popup).toHaveURL(
        `${host.url}/view/details/?fragment=details`,
      );
      await expect(popup.locator("#mb-main h2")).toHaveText("Details");
      expect(await popup.evaluate(() => window.opener === null)).toBe(true);
      await expect(page).toHaveURL(`${host.url}/view/home/`);
      await popup.close();
    }
    requests.assert();
  });
}
