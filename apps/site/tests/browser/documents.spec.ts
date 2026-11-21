import { expect, test } from "@playwright/test";

import { readReleases } from "../../src/changelog/releases.js";
import { SITE_PATHS } from "../../src/navigation.js";

const RELEASES = readReleases();

test("the feed is linked and serves the releases", async ({ page }) => {
  await page.goto(SITE_PATHS.changelog);
  await expect(
    page.locator('link[rel="alternate"][type="application/atom+xml"]'),
  ).toHaveAttribute("href", "/changelog.xml");
  const response = await page.request.get("/changelog.xml");
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain(
    `<title>Mokly CLI ${RELEASES[0]?.version ?? ""}</title>`,
  );
});

test("the plans documentation names both seats", async ({ page }) => {
  await page.goto("/docs/cloud/plans-and-billing/");
  const rows = page.getByRole("main").getByRole("row");
  await expect(rows.nth(1)).toContainText("Editor");
  await expect(rows.nth(2)).toContainText("Collaborator");
});

for (const [
  route,
  title,
  firstSection,
  related,
  destination,
  destinationTitle,
] of [
  [
    SITE_PATHS.terms,
    "Terms of Service",
    "1. What Mokly does",
    "Privacy",
    SITE_PATHS.privacy,
    "Privacy Policy",
  ],
  [
    SITE_PATHS.privacy,
    "Privacy Policy",
    "1. Controller and service role",
    "Terms",
    SITE_PATHS.terms,
    "Terms of Service",
  ],
  [
    SITE_PATHS.complaints,
    "Complaints",
    "1. How to complain",
    "Security",
    SITE_PATHS.security,
    "Security",
  ],
  [
    SITE_PATHS.security,
    "Security",
    "1. Hosting and isolation",
    "Complaints",
    SITE_PATHS.complaints,
    "Complaints",
  ],
] as const) {
  test(`${route} publishes Markdown and links to related policies`, async ({
    page,
  }) => {
    await page.goto(route);
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 }),
    ).toHaveText(title);
    await expect(
      page.getByRole("main").getByRole("heading", { level: 2 }).first(),
    ).toHaveText(firstSection);
    await expect(page.locator(".site-policy-date time")).toHaveAttribute(
      "datetime",
      "2026-09-22",
    );
    await expect(page.locator(".site-policy-date time")).toHaveText(
      "22 September 2026",
    );
    const navigation = page.getByRole("navigation", {
      name: "Legal documents",
    });
    await expect(navigation.getByRole("link")).toHaveCount(3);
    const link = navigation.getByRole("link", { name: related, exact: false });
    await expect(link).toHaveAttribute("href", destination);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 }),
    ).toHaveText(destinationTitle);
  });
}

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

test("the page frame hides its depictions from assistive technology", async ({
  page,
}) => {
  await page.goto("/does-not-exist/");
  await expect(page.getByRole("main")).toMatchAriaSnapshot(NOT_FOUND_MAIN);
});
