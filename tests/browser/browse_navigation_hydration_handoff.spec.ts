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
    if (imageRequests === 1) {
      await route.continue();
      return;
    }
    reportRequest();
    await requestReleased;
    await route.continue();
  });

  try {
    await page.goto(`${navigation.url}/view/screens/home.html`);
    await requestStarted;
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
  } finally {
    releaseRequest();
  }
});

test("an unowned exact-resource document stays frame-owned during replacement", async ({
  page,
}) => {
  await page.goto(`${navigation.url}/view/screens/home.html`);
  const frame = page.frameLocator(".mbk-frame-mobile iframe");

  let matchingRequests = 0;
  let releaseRequest = () => {};
  let reportRequest = () => {};
  const requestStarted = new Promise<void>((resolve) => {
    reportRequest = resolve;
  });
  const requestReleased = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route("**/static/screens/home.mobile.dark.html", async (route) => {
    matchingRequests++;
    if (matchingRequests === 1) {
      await route.continue();
      return;
    }
    reportRequest();
    await requestReleased;
    await route.continue();
  });

  await frame.locator("#unowned-next-scheme-link").click();
  await expect
    .poll(() =>
      page
        .locator(".mbk-frame-mobile iframe")
        .evaluate((element: HTMLIFrameElement) =>
          element.contentDocument?.URL.endsWith(
            "/static/screens/home.mobile.dark.html",
          ),
        ),
    )
    .toBe(true);

  try {
    await page.locator("[data-workspace-scheme]").click();
    await requestStarted;
    await expect(page.locator(".mbk-frame-mobile iframe")).toHaveAttribute(
      "data-mokly-frame-state",
      "loading",
    );

    const defaultPrevented = await page.evaluate(() => {
      const iframe = document.querySelector<HTMLIFrameElement>(
        ".mbk-frame-mobile iframe",
      )!;
      const doc = iframe.contentDocument!;
      const element = doc.querySelector("#mock-link")!;
      let prevented: boolean | undefined;
      doc.addEventListener(
        "click",
        (event) => {
          prevented = event.defaultPrevented;
          event.preventDefault();
        },
        { once: true },
      );
      element.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
        }),
      );
      return prevented;
    });
    expect(defaultPrevented).toBe(false);
    await page.waitForTimeout(100);
    await expect(page).toHaveURL(/\/view\/screens\/home\.html$/);
    await expect(page.locator("#mb-main h2")).toHaveText("Home");

    releaseRequest();
    await expect(page.locator(".mbk-frame-mobile iframe")).toHaveAttribute(
      "data-mokly-frame-state",
      "ready",
    );
    await frame.locator("#mock-link").click();
    await expect(page).toHaveURL(
      /\/view\/screens\/details\.html\?fragment=section$/,
    );
    await expect(page.locator("#mb-main h2")).toHaveText("Details");
  } finally {
    releaseRequest();
  }
});
