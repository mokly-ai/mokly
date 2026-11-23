import { expect, type Page } from "@playwright/test";

import { shellRoot } from "./browse_assertions.js";
import { test } from "./browser_test.js";
import { expectDestination } from "./navigation_destination.js";
import { nestedScriptNotice } from "./navigation_error_allowances.js";
import {
  routeNavigationNestedFrame,
  startNavigationFixture,
  type NavigationFixture,
} from "./navigation_fixture.js";
import {
  canvasFrame,
  expectFrameSource,
  chooseScheme,
  chooseViewport,
  NARROW_WINDOW,
} from "./workspace_actions.js";

let navigation: NavigationFixture;

test.beforeAll(async () => {
  navigation = await startNavigationFixture();
});

test.afterAll(async () => {
  await navigation?.close();
});

test.beforeEach(async ({ page, allowBrowserError }) => {
  allowBrowserError(nestedScriptNotice);
  await routeNavigationNestedFrame(page);
});

test("MockLink navigation reveals the destination and preserves shell state", async ({
  page,
}) => {
  await page.goto(`${navigation.url}/view/fixture/nested/home/`);
  await chooseViewport(page, "mobile");
  // The appearance leaves each canvas frame's own scheme; the Mobile · Dark
  // frame holds the link.
  await chooseScheme(page, "dark");
  const mobile = page.locator(canvasFrame("mobile", "dark"));
  await expect(mobile).toHaveAttribute("data-mokly-frame-state", "ready");
  const detailsPanel = page.locator("[data-workspace-inspector]");
  if ((await detailsPanel.getAttribute("data-open")) === "true") {
    await page.getByRole("tab", { name: "Details", exact: true }).click();
  }
  const other = page.locator('details[data-nav-folder="folder:other"]');
  await other.evaluate((element: HTMLDetailsElement) => {
    element.open = true;
  });
  await page.fill("[data-mokly-search]", "home");
  await page.click('[data-filter="changed"]');
  const detailsRow = page.locator(
    'a[data-nav-row][data-route="fixture/nested/details/index.html"]',
  );
  await expect(detailsRow).toBeHidden();
  await page
    .frameLocator(canvasFrame("mobile", "dark"))
    .locator("#mock-link")
    .click();

  await expect(page).toHaveURL(
    /\/view\/fixture\/nested\/details\/\?fragment=section$/,
  );
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expect(page.locator(".mbk-crumbs")).toContainText("Nested");
  await expect(detailsRow).toHaveAttribute("aria-current", "page");
  await expect(detailsRow).toBeVisible();
  await expect(page.locator("[data-mokly-search]")).toHaveValue("");
  await expect(page.locator('[data-filter="all"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(other).toHaveAttribute("open", "");
  for (const ancestor of await detailsRow
    .locator("xpath=ancestor::details")
    .all()) {
    await expect(ancestor).toHaveAttribute("open", "");
  }
  await expect(detailsPanel).not.toHaveAttribute("data-open", "true");
  // The viewport choice keeps the Mobile column alone on the canvas.
  await expect(page.locator(canvasFrame("desktop", "dark"))).toBeHidden();
  await expect(mobile).toBeVisible();
  await expect(page.locator(shellRoot)).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expectFrameSource(
    mobile,
    /details\/index\.mobile\.dark\.html#section$/,
  );

  await page.goBack();
  await expect(page.locator("#mb-main h2")).toHaveText("Home");
  await page.goForward();
  await expect(detailsRow).toHaveAttribute("aria-current", "page");
});

test("keyboard navigation retains constraints that already show the destination", async ({
  page,
}) => {
  await page.goto(`${navigation.url}/view/fixture/nested/home/`);
  await page.fill("[data-mokly-search]", "details");
  await page.frameLocator(canvasFrame("mobile")).locator("#mock-link").focus();
  await page.keyboard.press("Enter");

  await expectDestination(page);
  await expect(page.locator("[data-mokly-search]")).toHaveValue("details");
  await expect(page.locator('[data-filter="all"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.locator(
      'a[data-nav-row][data-route="fixture/nested/details/index.html"]',
    ),
  ).toHaveAttribute("aria-current", "page");
});

test("raw native links navigate from desktop, area, SVG, flow, and legacy frames", async ({
  page,
}) => {
  await navigateFrom(page, canvasFrame("desktop"), "#raw-link");
  await navigateFrom(page, canvasFrame("mobile"), "#area-link", true);
  await navigateFrom(page, canvasFrame("mobile"), "#svg-link");

  await page.goto(`${navigation.url}/view/fixture/nested/tour/`);
  await expect(page.locator(".mbk-flow-screen iframe").first()).toHaveAttribute(
    "data-mokly-frame-state",
    "ready",
  );
  await page
    .frameLocator(".mbk-flow-screen iframe")
    .first()
    .locator("#raw-link")
    .click();
  await expectDestination(page);

  // A page stands on the canvas as one reading frame.
  await page.goto(`${navigation.url}/view/guide/`);
  await expect(page.locator("[data-mokly-stage] iframe")).toHaveAttribute(
    "data-mokly-frame-state",
    "ready",
  );
  await page
    .frameLocator("[data-mokly-stage] iframe")
    .locator("#legacy-link")
    .click();
  await expectDestination(page);
});

test("logical activation stays host-owned during a frame source handoff", async ({
  page,
}) => {
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
    // The appearance swaps a frame's source on the one-frame stage, below the
    // layout breakpoint; a canvas frame keeps its own scheme.
    await page.setViewportSize(NARROW_WINDOW);
    await page.goto(`${navigation.url}/view/fixture/nested/home/`);
    await chooseViewport(page, "mobile");
    await chooseScheme(page, "dark");
    await requestStarted;
    await expect(page.locator(".mbk-frame-mobile iframe")).toHaveAttribute(
      "data-mokly-frame-state",
      "loading",
    );
    await page
      .frameLocator(".mbk-frame-mobile iframe")
      .locator("#area-link")
      .evaluate((element) =>
        element.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        ),
      );

    await expectDestination(page);
    await page.goBack();
    await expect(page).toHaveURL(/\/view\/fixture\/nested\/home\/$/);
    await expect(page.locator("#mb-main h2")).toHaveText("Home");
  } finally {
    releaseRequest();
  }
});

async function navigateFrom(
  page: Page,
  frameSelector: string,
  linkSelector: string,
  dispatch = false,
): Promise<void> {
  await page.goto(`${navigation.url}/view/fixture/nested/home/`);
  await expect(page.locator(frameSelector)).toHaveAttribute(
    "data-mokly-frame-state",
    "ready",
  );
  const link = page.frameLocator(frameSelector).locator(linkSelector);
  if (dispatch) {
    await link.evaluate((element) =>
      element.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      ),
    );
  } else {
    await link.click();
  }
  await expectDestination(page);
}
