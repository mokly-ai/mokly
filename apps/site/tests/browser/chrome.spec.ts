import { type Locator, type Page, expect, test } from "@playwright/test";

import {
  EXTERNAL_LINKS,
  GET_STARTED_PATH,
  SITE_PATHS,
} from "../../src/navigation.js";

import { NARROW_WIDTH, openLargeText } from "./large-text.js";
import { headerDestinations, narrow, openMenu } from "./menu.js";

const HEADER_LINKS = [
  SITE_PATHS.home,
  SITE_PATHS.docs,
  SITE_PATHS.changelog,
  SITE_PATHS.pricing,
  EXTERNAL_LINKS.github,
  GET_STARTED_PATH,
];

/** What the navigation lists above the breakpoint and the menu below it. */
const DESTINATIONS = ["Docs", "Changelog", "Pricing", "GitHub"];

/**
 * The banner of a documentation page as assistive technology reads it in
 * each composition. The desktop bar also draws the file title and the
 * people in the file, but they are depictions, so the banner holds nothing
 * else.
 */
const BANNER = {
  narrow: `
    - banner:
      - /children: equal
      - link "Mokly home"
      - link "Get started"
      - button "Menu"
  `,
  wide: `
    - banner:
      - /children: equal
      - link "Mokly home"
      - navigation "Main":
        - link "Docs"
        - link "Changelog"
        - link "Pricing"
        - link "GitHub"
      - link "Get started"
  `,
};

const FOOTER_LINKS = [
  SITE_PATHS.home,
  SITE_PATHS.home,
  SITE_PATHS.docs,
  SITE_PATHS.changelog,
  SITE_PATHS.pricing,
  SITE_PATHS.terms,
  SITE_PATHS.privacy,
  SITE_PATHS.complaints,
  SITE_PATHS.security,
];

/** The href of every anchor matched, including ones the viewport hides. */
async function hrefs(anchors: Locator): Promise<string[]> {
  return anchors.evaluateAll((nodes) =>
    nodes.map((anchor) => anchor.getAttribute("href") ?? ""),
  );
}

/**
 * A region's anchors. The banner's are the tool bar's: the brand, its
 * navigation and Get started; the menu's own links are checked with the
 * menu.
 */
function anchors(page: Page, region: "banner" | "contentinfo"): Locator {
  return region === "banner"
    ? page
        .getByRole("banner")
        .locator(".site-brand, .site-nav a, .site-header-cta")
    : page.getByRole("contentinfo").locator("a");
}

// Every site route these links name answers with its published heading in
// `pages.spec.ts`, so this test checks only the inventory of the links.
for (const region of ["banner", "contentinfo"] as const) {
  const expected = region === "banner" ? HEADER_LINKS : FOOTER_LINKS;
  test(`the ${region} links match the inventory`, async ({ page }) => {
    await page.goto(SITE_PATHS.home);
    expect(await hrefs(anchors(page, region))).toEqual(expected);
  });
}

test("Get started opens the app's sign-up", async ({ page }) => {
  // The app serves the sign-up route, so the site preview checks that the
  // press reaches the address, not the app's page.
  await page.goto(SITE_PATHS.home);
  const action = page
    .getByRole("banner")
    .getByRole("link", { name: "Get started" });
  await expect(action).toHaveAttribute("href", GET_STARTED_PATH);
  await action.click();
  await expect(page).toHaveURL(new RegExp(`${GET_STARTED_PATH}$`));
});

test("the header composition follows the viewport", async ({ page }) => {
  const wide = !narrow(page);
  await page.goto(SITE_PATHS.home);
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Mokly home" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Get started" })).toBeVisible();
  // The desktop bar draws the file title of the page with its branch chip,
  // and the people in the file.
  for (const depiction of [/^mokly\.ai\s*—\s*Home$/, "main", "M"]) {
    await expect(header.getByText(depiction, { exact: true })).toBeVisible({
      visible: wide,
    });
  }
  const control = header.getByRole("button", {
    exact: true,
    includeHidden: true,
    name: "Menu",
  });
  await expect(control).toHaveCount(1);
  await expect(control).toBeVisible({ visible: !wide });
  // The navigation keeps every destination; only the viewport decides
  // whether it is drawn. The menu lists them and Get started.
  const row = header.locator(".site-nav");
  await expect(row.locator("a")).toHaveText(DESTINATIONS);
  await expect(row).toBeVisible({ visible: wide });
  const visible = wide ? row : await openMenu(page);
  const listed = wide ? DESTINATIONS : [...DESTINATIONS, "Get started"];
  for (const name of listed) {
    await expect(
      visible.getByRole("link", { exact: true, name }),
    ).toBeVisible();
  }
});

test(
  "at 200% text in a 320px window the bar keeps the mark alone and its three controls apart",
  { tag: "@mobile" },
  async ({ page }) => {
    // At the default text size the bar holds the whole brand.
    await page.setViewportSize({ height: 900, width: NARROW_WIDTH });
    await page.goto(SITE_PATHS.docs);
    const header = page.getByRole("banner");
    const brand = header.getByRole("link", { exact: true, name: "Mokly home" });
    await expect(brand.getByText("mokly.")).toBeVisible();
    await openLargeText(page, SITE_PATHS.docs);
    await page.evaluate(() => document.fonts.ready);
    await expect(brand.getByText("mokly.")).toBeHidden();
    await expect(brand).toBeVisible();
    const boxes = [];
    for (const control of [
      brand,
      header.getByRole("link", { name: "Get started" }),
      header.getByRole("button", { exact: true, name: "Menu" }),
    ]) {
      const box = await control.boundingBox();
      if (!box) throw new Error("a control of the bar has no box");
      boxes.push(box);
    }
    const [mark] = boxes;
    expect(mark?.width).toBeGreaterThanOrEqual(44);
    expect(mark?.height).toBeGreaterThanOrEqual(44);
    expect(boxes[0]?.x).toBeGreaterThanOrEqual(0);
    for (const [index, box] of boxes.entries()) {
      const next = boxes[index + 1];
      const end = next === undefined ? NARROW_WIDTH : next.x;
      expect(box.x + box.width, `control ${index + 1}`).toBeLessThanOrEqual(
        end,
      );
    }
  },
);

test("the header hides its depictions from assistive technology", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.docs);
  await expect(page.getByRole("banner")).toMatchAriaSnapshot(
    narrow(page) ? BANNER.narrow : BANNER.wide,
  );
});

test("the current route is marked in the header and footer", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.docs);
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Docs" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("contentinfo").getByRole("link", {
      exact: true,
      name: "Home",
    }),
  ).not.toHaveAttribute("aria-current", "page");
  await expect(
    (await headerDestinations(page)).getByRole("link", { name: "Docs" }),
  ).toHaveAttribute("aria-current", "page");
  await page.goto(SITE_PATHS.privacy);
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }),
  ).toHaveAttribute("aria-current", "page");
  await page.goto(SITE_PATHS.changelog);
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Changelog" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    (await headerDestinations(page)).getByRole("link", { name: "Changelog" }),
  ).toHaveAttribute("aria-current", "page");
  await page.goto(SITE_PATHS.security);
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Security" }),
  ).toHaveAttribute("aria-current", "page");
  await page.goto(SITE_PATHS.pricing);
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Pricing" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    (await headerDestinations(page)).getByRole("link", { name: "Pricing" }),
  ).toHaveAttribute("aria-current", "page");
});

/**
 * Every link, button and radio in a region has a target at least 44px tall:
 * a press 21px above or below the middle of its box, on the outer whole
 * pixels of a 44px target, still lands on it. A control drawn smaller, such
 * as a 36px navigation link, reaches 44px through its transparent band. A
 * radio's target is its label, the segment that the reader presses.
 */
async function assertTargets(region: Locator): Promise<void> {
  for (const role of ["link", "button", "radio"] as const) {
    for (const control of await region.getByRole(role).all()) {
      // Reading the topmost element at a point needs the page's own hit
      // testing, which no locator exposes.
      const { name, reached } = await control.evaluate((node) => {
        const target = node.closest("label") ?? node;
        target.scrollIntoView({ block: "center" });
        const box = target.getBoundingClientRect();
        const x = box.left + box.width / 2;
        const middle = box.top + box.height / 2;
        return {
          name: node.getAttribute("aria-label") ?? target.textContent ?? "",
          reached: [middle - 21, middle + 21].map((y) =>
            target.contains(document.elementFromPoint(x, y)),
          ),
        };
      });
      expect(reached, name.trim()).toEqual([true, true]);
    }
  }
}

test("every header and footer target is at least 44px tall", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.docs);
  await assertTargets(page.getByRole("banner"));
  await assertTargets(page.getByRole("contentinfo"));
  if (narrow(page)) await assertTargets(await openMenu(page));
});
