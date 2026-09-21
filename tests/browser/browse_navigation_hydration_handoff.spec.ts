import { expect, test } from "@playwright/test";

import {
  startNavigationFixture,
  type NavigationFixture,
} from "./navigation_fixture.js";

let navigation: NavigationFixture;

test.beforeAll(async () => {
  navigation = await startNavigationFixture();
});

test.afterAll(async () => {
  await navigation.close();
});

test("initial hydration keeps logical frame navigation host-owned", async ({
  page,
}) => {
  let imageRequests = 0;
  let releaseRequest = () => {};
  let reportRequest = () => {};
  const requestStarted = new Promise<void>((resolve) => {
    reportRequest = resolve;
  });
  const requestReleased = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route("**/static/slow-navigation-desktop.svg", async (route) => {
    imageRequests++;
    if (imageRequests > 1) {
      await route.continue();
    } else {
      reportRequest();
      await requestReleased;
      await route.continue();
    }
  });

  const initialNavigation = page.goto(
    `${navigation.url}/view/screens/home.html`,
  );
  try {
    await requestStarted;
    await expect(page.locator("html")).toHaveAttribute(
      "data-mokly-hydrated",
      "",
    );
    const frame = page.locator(".mbk-frame-desktop iframe");
    await expect(frame).toHaveAttribute("data-mokly-frame-state", "loading");
    await page
      .frameLocator(".mbk-frame-desktop iframe")
      .locator("#raw-link")
      .evaluate((element) =>
        element.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        ),
      );

    await expect(page).toHaveURL(
      /\/view\/screens\/details\.html\?fragment=section$/,
    );
    await expect(page.locator("#mb-main h2")).toHaveText("Details");
    expect(imageRequests).toBe(1);
  } finally {
    releaseRequest();
    await initialNavigation;
  }
});
