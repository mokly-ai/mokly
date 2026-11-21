import { expect, test } from "@playwright/test";

import { readReleases } from "../../src/changelog/releases.js";
import { SITE_PATHS } from "../../src/navigation.js";

const RELEASES = readReleases();

test("the changelog publishes every release, newest first", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.changelog);
  const newest = RELEASES[0];
  expect(newest).toBeDefined();
  const rows = page.locator(".site-release");
  await expect(rows).toHaveCount(RELEASES.length);
  const first = rows.first();
  await expect(first).toHaveAttribute("id", newest?.anchor ?? "");
  await expect(first.getByRole("heading", { level: 2 })).toHaveText(
    `Mokly CLI ${newest?.version ?? ""}`,
  );
  await expect(first.locator("time")).toHaveAttribute(
    "datetime",
    newest?.date ?? "",
  );
  await expect(first.locator("time")).toHaveText(newest?.readableDate ?? "");
  await expect(
    first.getByRole("link", { name: "Read release details" }),
  ).toHaveAttribute("href", newest?.link ?? "");
  await expect(first.locator(".site-release-group-head").first()).toHaveText(
    newest?.sections[0]?.heading ?? "",
  );
});

test("the release index reaches the release it names", async ({ page }) => {
  await page.goto(SITE_PATHS.changelog);
  const newest = RELEASES[0];
  const index = page.locator(".site-release-index-link");
  await expect(index).toHaveCount(RELEASES.length);
  await expect(index.first()).toContainText(newest?.version ?? "");
  await index.first().click();
  await expect(page).toHaveURL(new RegExp(`#${newest?.anchor ?? ""}$`));
  await expect(page.locator(`#${newest?.anchor ?? ""}`)).toBeInViewport();
});

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

test(
  "desktop release lists start 12px below their heading lines",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto(SITE_PATHS.changelog);
    for (const release of RELEASES) {
      const row = page.getByRole("article").filter({
        has: page.getByRole("heading", {
          level: 2,
          name: `Mokly CLI ${release.version}`,
          exact: true,
        }),
      });
      for (const section of release.sections) {
        const heading = row.getByText(section.heading, { exact: true });
        // Geometry needs browser evaluation. The text lines expose empty height
        // in a stretched heading box that a box-to-box gap would miss.
        const measured = await heading.evaluate(async (element) => {
          await document.fonts.ready;
          const list = element.nextElementSibling;
          if (!(list instanceof HTMLUListElement)) {
            throw new Error("the release group is missing its notes list");
          }
          const box = element.getBoundingClientRect();
          const text = document.createRange();
          text.selectNodeContents(element);
          const lines = new Set(
            Array.from(text.getClientRects(), (line) => line.top),
          ).size;
          const intrinsicHeight =
            Number.parseFloat(getComputedStyle(element).lineHeight) * lines;
          return {
            headingHeight: box.height,
            intrinsicHeight,
            gap: list.getBoundingClientRect().top - box.top - intrinsicHeight,
          };
        });
        expect
          .soft(
            measured.gap,
            `Mokly CLI ${release.version} / ${section.heading}: ${JSON.stringify(measured)}`,
          )
          .toBe(12);
      }
    }
  },
);
