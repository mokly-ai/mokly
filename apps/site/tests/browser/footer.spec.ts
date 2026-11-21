import { expect, test } from "@playwright/test";

import { SITE_PATHS } from "../../src/navigation.js";

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
