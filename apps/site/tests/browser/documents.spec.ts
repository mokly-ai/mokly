import { expect, test } from "@playwright/test";

import { SITE_PATHS } from "../../src/navigation.js";

test(
  "a related policy link opens the published policy",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto(SITE_PATHS.terms);
    await page
      .getByRole("navigation", { name: "Legal documents" })
      .getByRole("link", { name: "Privacy" })
      .click();
    await expect(page).toHaveURL(new RegExp(`${SITE_PATHS.privacy}$`));
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 }),
    ).toHaveText("Privacy Policy");
  },
);

/**
 * The not-found document as assistive technology reads it. It shares the
 * legal documents' page frame and holds only its heading; the frame's file
 * label and its selection are depictions, so the main holds nothing else.
 */
const NOT_FOUND_MAIN = `
  - main:
    - /children: equal
    - heading "Page not found" [level=1]
`;

test(
  "the page frame hides its depictions from assistive technology",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto("/does-not-exist/");
    await expect(page.getByRole("main")).toMatchAriaSnapshot(NOT_FOUND_MAIN);
  },
);
