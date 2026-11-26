import { type Locator, expect, test } from "@playwright/test";

import { GET_STARTED_PATH, SITE_PATHS } from "../../src/navigation.js";

import { NARROW_WIDTH, openLargeText } from "./large-text.js";
import { narrow, openMenu } from "./menu.js";

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

test(
  "Get started opens the app's sign-up",
  { tag: "@desktop" },
  async ({ page }) => {
    // The app serves the sign-up route, so the site preview checks that the
    // press reaches the address, not the app's page.
    await page.goto(SITE_PATHS.home);
    const action = page
      .getByRole("banner")
      .getByRole("link", { name: "Get started" });
    await action.click();
    await expect(page).toHaveURL(new RegExp(`${GET_STARTED_PATH}$`));
  },
);

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
  await expect(control).toBeVisible({ visible: !wide });
  // The viewport selects the toolbar navigation or the menu.
  const row = header.locator(".site-nav");
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
