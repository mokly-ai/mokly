import { expect, test } from "@playwright/test";

import { SITE_PATHS } from "../../src/navigation.js";

import { NARROW_WIDTH, openLargeText } from "./large-text.js";
import { narrow } from "./menu.js";

/**
 * The footer frame and the status bar under it. The chrome spec checks the
 * footer's links, its current page and its targets with the header's, and
 * the scheme spec checks the scheme control.
 */

/**
 * The footer as assistive technology reads it: the brand column with the
 * scheme control, then the two link groups. The frame label and the status
 * bar under the frame are depictions, so the footer holds nothing else. Each
 * option's label text follows its radio.
 */
const FOOTER = `
  - contentinfo:
    - /children: equal
    - link "Mokly home"
    - paragraph: The Mokly CLI is open source under the MIT license.
    - group "Color scheme":
      - radio "Light"
      - radio "Dark"
    - navigation "Footer":
      - /children: equal
      - paragraph: Product
      - link "Home"
      - link "Docs"
      - link "Changelog"
      - link "Pricing"
      - paragraph: Legal
      - link "Terms"
      - link "Privacy"
      - link "Complaints"
      - link "Security"
`;

test("the footer hides its depictions from assistive technology", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.terms);
  await expect(page.getByRole("contentinfo")).toMatchAriaSnapshot(FOOTER);
});

test("the status bar under the footer frame depicts the page's file", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.terms);
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByText("Footer", { exact: true })).toBeVisible();
  // The desktop bar names the file of the page; the mobile one leaves it out.
  await expect(
    footer.getByText(/^mokly\.ai\s*—\s*Terms$/, { exact: true }),
  ).toBeVisible({ visible: !narrow(page) });
  // The people's line also holds their avatars' initials, and the zoom pill
  // its − and + signs.
  await expect(footer.getByText("4 in this file")).toBeVisible();
  await expect(footer.getByText("100%")).toBeVisible();
});

test(
  "at 200% text in a 320px window every footer link stays inside the window, apart from the others",
  { tag: "@mobile" },
  async ({ page }) => {
    await openLargeText(page, SITE_PATHS.terms);
    const navigation = page
      .getByRole("contentinfo")
      .getByRole("navigation", { name: "Footer" });
    const boxes = [];
    for (const link of await navigation.getByRole("link").all()) {
      const box = await link.boundingBox();
      if (!box) throw new Error("a footer link has no box");
      expect(box.x, await link.innerText()).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, await link.innerText()).toBeLessThanOrEqual(
        NARROW_WIDTH,
      );
      boxes.push(box);
    }
    expect(boxes).toHaveLength(8);
    for (const [index, box] of boxes.entries())
      for (const other of boxes.slice(index + 1)) {
        const apart =
          box.x + box.width <= other.x ||
          other.x + other.width <= box.x ||
          box.y + box.height <= other.y ||
          other.y + other.height <= box.y;
        expect(
          apart,
          `links ${index + 1} and ${boxes.indexOf(other) + 1}`,
        ).toBe(true);
      }
  },
);

test("a focused footer link draws its glow with rounded corners", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.terms);
  // A press of Tab gives the page keyboard focus, so the link that takes
  // focus next matches :focus-visible and draws the glow.
  await page.keyboard.press("Tab");
  const link = page
    .getByRole("contentinfo")
    .getByRole("link", { exact: true, name: "Privacy" });
  await link.focus();
  await expect(link).toBeFocused();
  const corners = await link.evaluate((node) => {
    const style = getComputedStyle(node);
    return [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius,
    ].map((radius) => Number.parseFloat(radius));
  });
  for (const radius of corners) expect(radius).toBeGreaterThan(0);
});
