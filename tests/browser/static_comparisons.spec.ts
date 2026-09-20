import { expect, test } from "@playwright/test";

import { startStaticFixture } from "./static_fixture.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

let site: Awaited<ReturnType<typeof startStaticFixture>>;
test.beforeAll(async () => {
  site = await startStaticFixture(true);
});
test.afterAll(async () => {
  await site.close();
});

test("isolated comparisons stay lazy, immutable, sandboxed, and responsive", async ({
  page,
}) => {
  const requests: string[] = [];
  const renewals: string[] = [];
  const failures: string[] = [];
  page.on("request", (request) => {
    requests.push(request.url());
    if (request.method() === "HEAD") renewals.push(request.url());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  await page.goto(`${site.url}/view/screens/home.html`);
  expect(requests.some((url) => /\/diffs\/|\/events/.test(url))).toBe(false);
  const modes = page.getByRole("group", { name: "Comparison mode" });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const viewport of ["mobile", "desktop", "both"] as const) {
      await chooseViewport(page, viewport);
      for (const scheme of ["light", "dark"] as const) {
        await chooseScheme(page, scheme);
        for (const mode of ["Side by side", "Overlay", "Difference"]) {
          await modes.getByRole("button", { name: mode, exact: true }).click();
          const frames = page.locator("[data-diff-stage] iframe");
          await expect(frames).toHaveCount(viewport === "both" ? 4 : 2);
          await expect(
            page.frameLocator("[data-diff-stage] iframe").first().locator("h1"),
          ).toHaveText("Previous home");
          await expect(
            page.frameLocator("[data-diff-stage] iframe").last().locator("h1"),
          ).toHaveText("Current home");
          for (const frame of await frames.all()) {
            await expect(frame).toHaveAttribute("sandbox", "");
            await expect(frame).toHaveAttribute(
              "src",
              /\/diffs\/__generations\/[a-f0-9]{64}\//,
            );
          }
        }
      }
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Refresh comparison" }).click();
  await expect(page.locator("[data-diff-stage] iframe")).toHaveCount(4);
  await modes.getByRole("button", { name: "Current", exact: true }).click();
  await expect(page.locator("[data-diff-stage] iframe")).toHaveCount(0);
  const json = requests.filter((url) => url.includes("review.json"));
  expect(json).toHaveLength(2);
  expect(renewals).toEqual([]);
  expect(new Set(json.map((url) => url.split("?")[0])).size).toBe(1);
  expect(json.some((url) => url.endsWith("?refresh=1"))).toBe(true);
  expect(requests.some((url) => url.includes("/__mokly/events"))).toBe(false);
  expect(failures).toEqual([]);
});

test("added and removed screens stay current while light-only comparisons retain their sides", async ({
  page,
}) => {
  await page.goto(`${site.url}/id/added/`);
  await chooseViewport(page, "mobile");
  await expect(page).toHaveURL(`${site.url}/view/screens/added.html`);
  await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
  await expect(
    page.frameLocator('[data-workspace-frame="mobile"]').locator("main"),
  ).toHaveText("added");

  await page.goto(`${site.url}/id/removed/`);
  await chooseViewport(page, "mobile");
  await expect(page).toHaveURL(`${site.url}/view/screens/removed.html`);
  await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
  await expect(page.locator(".mbk-diff-toolbar")).toHaveCount(0);
  await expect(page.locator(".mbk-previous")).toHaveText(
    "Showing previous version",
  );
  await expect(
    page
      .frameLocator("[data-mokly-preview] .mbk-frame-mobile iframe")
      .locator("main"),
  ).toHaveText("removed");
  await expect(page.locator("[data-diff-stage]")).toHaveCount(0);
  await page.goto(`${site.url}/view/screens/details.html`);
  await chooseScheme(page, "dark");
  await page.getByRole("button", { name: "Overlay", exact: true }).click();
  for (const frame of await page.locator("[data-diff-stage] iframe").all())
    await expect(frame).not.toHaveAttribute("src", /\.dark\.html$/);
});

test("static failures retry the same generation and abandoned requests stay cancelled", async ({
  page,
}) => {
  await page.goto(`${site.url}/view/screens/home.html`);
  await chooseViewport(page, "mobile");
  let fail = true;
  await page.route("**/review.json*", async (route) => {
    if (fail)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: "{}",
      });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Overlay", exact: true }).click();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("[data-diff-stage] iframe")).toHaveCount(2);
  await page.unroute("**/review.json*");
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/review.json*", async (route) => {
    await gate;
    await route.continue().catch(() => undefined);
  });
  await page.getByRole("button", { name: "Current", exact: true }).click();
  await page.getByRole("button", { name: "Overlay", exact: true }).click();
  await expect(page.locator("[data-diff-stage]")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await page.locator('[data-route="screens/details.html"]').click();
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  release?.();
  await expect(
    page.getByRole("button", { name: "Current", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-diff-stage] iframe")).toHaveCount(0);
});

test("malformed static metadata never falls back to a live comparison endpoint", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(`${site.url}/view/screens/home.html`);
  await page
    .locator("html")
    .evaluate((root) => root.removeAttribute("data-mokly-delivery"));
  await page.getByRole("button", { name: "Overlay", exact: true }).click();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  expect(requests.some((url) => url.includes("review.json"))).toBe(false);
});
