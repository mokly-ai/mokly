/**
 * Frame link ownership at the edges of a frame's life, under the frame link
 * navigation and navigation contracts: right after the first mount, while the
 * desktop document still loads, and while a scheme change replaces a document
 * with the exact resource that the frame already shows.
 */

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
    route.fulfill({ body: "<p>Cross-origin</p>", contentType: "text/html" }),
  );
});

test("a logical link right after the first mount is host-owned while the frame still loads", async ({
  page,
}) => {
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let images = 0;
  // The desktop document cannot finish loading while its image is held.
  await page.route("**/slow-navigation-desktop.svg", async (route) => {
    images += 1;
    if (images === 1) await held;
    await route.continue();
  });
  const opened = page.goto(
    `${navigation.url}/view/fixture/nested/home/?viewport=desktop`,
  );
  try {
    await expect.poll(() => images).toBe(1);
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
    await expectDestination(page);
    expect(images).toBe(1);
  } finally {
    release();
    await opened;
  }
});

test("a scheme change that loads the exact resource the frame shows keeps the old document frame-owned", async ({
  page,
}) => {
  const dark =
    "/static/mokly-generated/fixture/nested/home/index.mobile.dark.html";
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  // The frame's own link loads the dark document; the shell's replacement
  // of the same resource waits until the test releases it.
  await page.route(`**${dark}`, async (route) => {
    requests += 1;
    if (requests > 1) await held;
    await route.continue();
  });
  await page.goto(`${navigation.url}/view/fixture/nested/home/`);
  const element = page.locator(".mbk-frame-mobile iframe");
  const frame = page.frameLocator(".mbk-frame-mobile iframe");
  await frame.locator("#unowned-next-scheme-link").click();
  await expect
    .poll(() =>
      element.evaluate(
        (iframe: HTMLIFrameElement) => iframe.contentDocument?.URL ?? "",
      ),
    )
    .toMatch(new RegExp(`${dark.replaceAll(".", "\\.")}$`));
  try {
    await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
    await expect.poll(() => requests).toBe(2);
    await expect(element).toHaveAttribute("data-mokly-frame-state", "loading");
    // The document that the frame navigated to itself stays frame-owned: the
    // shell does not take its logical link while the replacement loads.
    const prevented = await element.evaluate((iframe: HTMLIFrameElement) => {
      const doc = iframe.contentDocument!;
      let defaultPrevented: boolean | undefined;
      doc.addEventListener(
        "click",
        (event) => {
          defaultPrevented = event.defaultPrevented;
          event.preventDefault();
        },
        { once: true },
      );
      doc
        .querySelector("#mock-link")!
        .dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
      return defaultPrevented;
    });
    expect(prevented).toBe(false);
    await expect(page).toHaveURL(/\/view\/fixture\/nested\/home\/$/);
    await expect(page.locator("#mb-main h2")).toHaveText("Home");

    release();
    await expect(element).toHaveAttribute("data-mokly-frame-state", "ready");
    await frame.locator("#mock-link").click();
    await expectDestination(page);
  } finally {
    release();
  }
});
