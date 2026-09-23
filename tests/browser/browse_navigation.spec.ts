import { expect, test, type Page } from "@playwright/test";

import {
  startNavigationFixture,
  type NavigationFixture,
} from "./navigation_fixture.js";
import { expectFrameSource } from "./workspace_actions.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

let navigation: NavigationFixture;

test.beforeAll(async () => {
  navigation = await startNavigationFixture();
});

test.afterAll(async () => {
  await navigation.close();
});

async function actAndWaitForFrameLoad(
  page: Page,
  frameSelector: string,
  act: () => Promise<void>,
): Promise<void> {
  const frame = page.locator(frameSelector);
  await frame.evaluate((element) => {
    element.setAttribute("data-test-load-state", "pending");
    element.addEventListener(
      "load",
      () => element.setAttribute("data-test-load-state", "complete"),
      { once: true },
    );
  });
  await act();
  await expect(frame).toHaveAttribute("data-test-load-state", "complete", {
    timeout: 15_000,
  });
  await frame.evaluate((element) =>
    element.removeAttribute("data-test-load-state"),
  );
}

test("MockLink navigation reveals the destination and preserves shell state", async ({
  page,
}) => {
  await page.goto(`${navigation.url}/view/screens/home.html`);
  await chooseViewport(page, "mobile");
  // Changing the appearance reloads the frame, which is what this exercises.
  await actAndWaitForFrameLoad(page, ".mbk-frame-mobile iframe", () =>
    chooseScheme(page, "dark"),
  );
  const detailsPanel = page.locator("[data-workspace-inspector]");
  if ((await detailsPanel.getAttribute("data-open")) === "true") {
    await page.getByRole("tab", { name: "Details", exact: true }).click();
  }
  const other = page.locator('details[data-nav-collection="collection:other"]');
  await other.evaluate((element: HTMLDetailsElement) => {
    element.open = true;
  });
  await page.fill("[data-mokly-search]", "home");
  await page.click('[data-filter="changed"]');
  const detailsRow = page.locator(
    'a[data-nav-row][data-route="screens/details.html"]',
  );
  await expect(detailsRow).toBeHidden();
  await page
    .frameLocator(".mbk-frame-mobile iframe")
    .locator("#mock-link")
    .click();

  await expect(page).toHaveURL(
    /\/view\/screens\/details\.html\?fragment=section$/,
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
  await expect(page.locator("[data-mokly-stage]")).toHaveAttribute(
    "data-viewport",
    "mobile",
  );
  await expect(page.locator("body")).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expectFrameSource(
    page.locator(".mbk-frame-mobile iframe"),
    /details\.mobile\.dark\.html#section$/,
  );

  await page.goBack();
  await expect(page.locator("#mb-main h2")).toHaveText("Home");
  await page.goForward();
  await expect(detailsRow).toHaveAttribute("aria-current", "page");
});

test("keyboard navigation retains constraints that already show the destination", async ({
  page,
}) => {
  await page.goto(`${navigation.url}/view/screens/home.html`);
  await page.fill("[data-mokly-search]", "details");
  await page
    .frameLocator(".mbk-frame-mobile iframe")
    .locator("#mock-link")
    .focus();
  await page.keyboard.press("Enter");

  await expectDestination(page);
  await expect(page.locator("[data-mokly-search]")).toHaveValue("details");
  await expect(page.locator('[data-filter="all"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.locator('a[data-nav-row][data-route="screens/details.html"]'),
  ).toHaveAttribute("aria-current", "page");
});

test("Changed navigation preserves collapsed unrelated groups", async ({
  page,
}) => {
  await page.goto(`${navigation.url}/view/screens/home.html`);
  await page.click('[data-filter="changed"]');
  const other = page.locator('details[data-nav-collection="collection:other"]');
  await expect(other).toHaveAttribute("open", "");
  await other.locator("summary").click();
  await expect(other).not.toHaveAttribute("open", "");

  await page.click('a[data-nav-row][data-route="user-flows/tour.html"]');

  await expect(page.locator("#mb-main h2")).toHaveText("Tour");
  await expect(page.locator('[data-filter="changed"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(other).not.toHaveAttribute("open", "");
});

test("editing an active filter reveals newly matching groups", async ({
  page,
}) => {
  await page.goto(`${navigation.url}/view/screens/home.html`);
  await page.click('[data-filter="changed"]');
  const other = page.locator('details[data-nav-collection="collection:other"]');
  await other.locator("summary").click();
  await expect(other).not.toHaveAttribute("open", "");

  await page.fill("[data-mokly-search]", "extra");

  await expect(other).toHaveAttribute("open", "");
  await expect(
    page.locator('a[data-nav-row][data-route="screens/extra.html"]'),
  ).toBeVisible();
});

test("clearing filtering keeps the destination collection open", async ({
  page,
}) => {
  await page.goto(`${navigation.url}/view/screens/home.html`);
  const other = page.locator('details[data-nav-collection="collection:other"]');
  await other.locator("summary").click();
  await expect(other).not.toHaveAttribute("open", "");
  await page.click('[data-filter="changed"]');

  await page.click('a[data-nav-row][data-route="screens/extra.html"]');
  await expect(page.locator("#mb-main h2")).toHaveText("Extra");
  await page.click('[data-filter="all"]');

  await expect(other).toHaveAttribute("open", "");
  await expect(
    page.locator('a[data-nav-row][data-route="screens/extra.html"]'),
  ).toHaveAttribute("aria-current", "page");
});

test("raw native links navigate from desktop, area, SVG, flow, and legacy frames", async ({
  page,
}) => {
  await navigateFrom(page, ".mbk-frame-desktop iframe", "#raw-link");
  await navigateFrom(page, ".mbk-frame-mobile iframe", "#area-link", true);
  await navigateFrom(page, ".mbk-frame-mobile iframe", "#svg-link");

  await page.goto(`${navigation.url}/view/user-flows/tour.html`);
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

  await page.goto(`${navigation.url}/view/guide.html`);
  await expect(page.locator(".mbk-stage-embed iframe")).toHaveAttribute(
    "data-mokly-frame-state",
    "ready",
  );
  await page
    .frameLocator(".mbk-stage-embed iframe")
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
  await page.route("**/static/screens/home.mobile.dark.html", async (route) => {
    reportRequest();
    await requestReleased;
    await route.continue();
  });

  try {
    await page.goto(`${navigation.url}/view/screens/home.html`);
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
    await expect(page).toHaveURL(/\/view\/screens\/home\.html$/);
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
  await page.goto(`${navigation.url}/view/screens/home.html`);
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

async function expectDestination(page: Page): Promise<void> {
  await expect(page).toHaveURL(
    /\/view\/screens\/details\.html\?fragment=section$/,
  );
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
}
