import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { expectDestination } from "./navigation_destination.js";
import { nestedScriptNotice } from "./navigation_error_allowances.js";
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

test.beforeEach(async ({ page, allowBrowserError }) => {
  allowBrowserError(nestedScriptNotice);
  await page.route("https://cross-origin.example.test/nested.html", (route) =>
    route.fulfill({
      body: '<a data-mokly-link="details#section" href="/details" id="cross-marked" target="_top">Marked</a><a href="#ordinary" id="cross-unmarked" target="_top">Ordinary</a><a href="#popup" id="cross-popup" target="_blank">Popup</a><script>parent.__crossScriptRan=true</script>',
      contentType: "text/html",
    }),
  );
});

test("an unowned frame document stays frame-owned during shell replacement", async ({
  page,
}) => {
  await page.goto(`${navigation.url}/view/fixture/nested/home/`);
  const frame = page.frameLocator(".mbk-frame-mobile iframe");
  await frame.locator("#unowned-details-link").click();
  await expect(frame.locator("#extra-link")).toBeVisible();

  let releaseRequest = () => {};
  let reportRequest = () => {};
  const requestStarted = new Promise<void>((resolve) => {
    reportRequest = resolve;
  });
  const requestReleased = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route(
    "**/static/mokly-generated/fixture/nested/home/index.mobile.dark.html",
    async (route) => {
      reportRequest();
      await requestReleased;
      await route.continue();
    },
  );

  try {
    await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
    await requestStarted;
    await expect(page.locator(".mbk-frame-mobile iframe")).toHaveAttribute(
      "data-mokly-frame-state",
      "loading",
    );

    const defaultPrevented = await page.evaluate(() => {
      const frame = document.querySelector<HTMLIFrameElement>(
        ".mbk-frame-mobile iframe",
      )!;
      const doc = frame.contentDocument!;
      const element = doc.querySelector("#extra-link")!;
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
    await expect(page).toHaveURL(/\/view\/fixture\/nested\/home\/$/);
    await expect(page.locator("#mb-main h2")).toHaveText("Home");

    releaseRequest();
    await expect(page.locator(".mbk-frame-mobile iframe")).toHaveAttribute(
      "data-mokly-frame-state",
      "ready",
    );
    await frame.locator("#mock-link").click();
    await expectDestination(page);
  } finally {
    releaseRequest();
  }
});
