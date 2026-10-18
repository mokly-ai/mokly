import { expect } from "@playwright/test";

import { staticRequests } from "./static_delivery_assertions.js";
import { test } from "./static_test.js";

for (const width of [390, 1440]) {
  test(`${width}px: current-only copies omit Changes and comparison controls despite saved or URL state`, async ({
    page,
  }) => {
    const requests = staticRequests(page);
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem("mokly:comparison-scroll-together", "on");
    });
    await page.goto("/view/example/screens/welcome/?comparison=side");
    for (const reload of [false, true]) {
      if (reload) await page.reload();
      await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
      await expect(
        page.getByRole("group", { name: "Comparison mode" }),
      ).toHaveCount(0);
      if (width < 700)
        await page
          .getByRole("button", { name: "Open catalogue navigation" })
          .click();
      await expect(
        page.getByRole("navigation", { name: "Catalogue" }),
      ).toBeVisible();
      await expect(
        page.getByRole("group", {
          name: "Catalogue filter",
          includeHidden: true,
        }),
      ).toHaveCount(0);
    }
    expect(requests.urls.filter((url) => url.includes("/diffs/"))).toEqual([]);
    requests.assert();
  });
}
