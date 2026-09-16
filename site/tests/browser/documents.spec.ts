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

for (const [route, title, body, cross, back] of [
  [
    SITE_PATHS.terms,
    "Terms",
    "Terms are being prepared",
    "Privacy",
    SITE_PATHS.privacy,
  ],
  [
    SITE_PATHS.privacy,
    "Privacy",
    "Privacy details are being prepared",
    "Terms",
    SITE_PATHS.terms,
  ],
] as const) {
  test(`${route} publishes its placeholder and links across`, async ({
    page,
  }) => {
    await page.goto(route);
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 }),
    ).toHaveText(title);
    await expect(
      page.getByRole("main").getByRole("heading", { level: 2 }),
    ).toHaveText(body);
    await expect(page.locator(".site-policy-date")).toHaveCount(0);
    const link = page
      .getByRole("main")
      .getByRole("link", { name: cross, exact: false });
    await expect(link).toHaveAttribute("href", back);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${back}$`));
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 }),
    ).toHaveText(cross);
  });
}
