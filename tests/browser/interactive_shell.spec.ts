import { expect, test, type Page } from "@playwright/test";

import { interactiveShellFixture } from "./interactive_shell_fixture.js";
import {
  expectLive,
  expectLiveReady,
  expectStatic,
  liveFrame,
  previewMode,
  UNAVAILABLE,
} from "./interactive_shell_helpers.js";

let fixture: Awaited<ReturnType<typeof interactiveShellFixture>>;

test.beforeAll(async () => {
  fixture = await interactiveShellFixture();
});

test.afterAll(async () => {
  await fixture?.close();
});

async function open(page: Page, route: string): Promise<void> {
  await page.goto(`${fixture.url}/view/${route}`);
  await expect(page.locator("html")).toHaveAttribute("data-mokly-react-shell");
}

test("Static and Live appear only for current screens and saved variants", async ({
  page,
}) => {
  for (const [route, heading] of [
    ["screens/home.html", "Home"],
    ["components/counter.html", "Counter"],
  ] as const) {
    await open(page, route);
    await expect(page.locator("#mb-main h2")).toHaveText(heading);
    const tools = page.getByRole("group", { name: "View options" });
    await expect(
      tools.getByRole("group", { name: "Preview mode" }),
    ).toBeVisible();
    await expectStatic(page);
  }
  for (const [route, heading] of [
    ["guide.html", "Guide"],
    ["user-flows/tour.html", "Tour"],
    ["screens/retired.html", "Retired"],
  ] as const) {
    await open(page, route);
    await expect(page.locator("#mb-main h2")).toHaveText(heading);
    await expect(previewMode(page)).toHaveCount(0);
  }

  await open(page, "screens/details.html");
  await expect(previewMode(page)).toBeVisible();
  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  await expect(previewMode(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Current", exact: true }).click();
  await expect(previewMode(page)).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const title = (await page.locator("#mb-main h2").boundingBox())!;
  const control = (await previewMode(page).boundingBox())!;
  expect(control.y).toBeGreaterThan(title.y + title.height - 1);
  expect(control.x + control.width).toBeLessThanOrEqual(390);
});

test("a failed preparation keeps Static with Live described as unavailable", async ({
  page,
}) => {
  await page.route("**/__mokly/interactive/*/prepare", async (route) => {
    const generation = /interactive\/([a-f0-9]{32})\/prepare/.exec(
      route.request().url(),
    )?.[1];
    await route.fulfill({
      body: JSON.stringify({ generation, state: "failed" }),
      contentType: "application/json",
      status: 503,
    });
  });
  await open(page, "screens/home.html");
  const live = previewMode(page).getByRole("button", { name: "Live" });
  await live.click();
  await expect(live).toHaveAttribute("aria-disabled", "true");
  await expect(live).toHaveAttribute("title", UNAVAILABLE);
  await expect(live).toHaveAccessibleDescription(UNAVAILABLE);
  await expectStatic(page);
  await expect(
    page.locator('iframe[data-workspace-frame="desktop"]'),
  ).toHaveAttribute("sandbox", "allow-same-origin");
  await page.locator('a[data-route="components/counter.html"]').click();
  await expect(page.locator("#mb-main h2")).toHaveText("Counter");
  await expect(live).toHaveAttribute("aria-disabled", "true");
  await page.unroute("**/__mokly/interactive/*/prepare");
  await page.reload();
  await expect(live).not.toHaveAttribute("aria-disabled");
});

test("Live prepares while the bundle builds, then mounts on the Live origin", async ({
  page,
}) => {
  await open(page, "screens/home.html");
  const staticFrame = page.locator('iframe[data-workspace-frame="desktop"]');
  await expect(staticFrame).toHaveAttribute(
    "src",
    "/static/screens/home.desktop.html",
  );
  await expect(staticFrame).toHaveAttribute("sandbox", "allow-same-origin");
  const prepared = page.waitForRequest("**/__mokly/interactive/*/prepare");
  await previewMode(page).getByRole("button", { name: "Live" }).click();
  await prepared;
  await expectLive(page);
  const preparing = page.locator(".mbk-live-preparing");
  await expect(preparing).toHaveCount(2);
  for (const status of await preparing.getByRole("status").all())
    await expect(status).toHaveText("Getting the live preview ready");
  await expect(page.locator("iframe[data-workspace-frame]")).toHaveCount(0);
  await expect(page.locator(".mbk-live-frame iframe")).toHaveCount(0);

  await previewMode(page).getByRole("button", { name: "Static" }).click();
  await expectStatic(page);
  await expect(page.locator(".mbk-live-frame")).toHaveCount(0);
  await expect(staticFrame).toBeVisible();

  await previewMode(page).getByRole("button", { name: "Live" }).click();
  await expect(preparing).toHaveCount(2);
  fixture.gate.open();
  await expectLiveReady(page);
  await expect(
    page.locator('iframe[data-mokly-live-frame="desktop"]'),
  ).toHaveAttribute("sandbox", "allow-same-origin allow-scripts");
  const location = await liveFrame(page, "desktop")
    .locator("body")
    .evaluate(() => ({
      host: new URLSearchParams(window.location.search).get("mokly-host"),
      origin: window.location.origin,
      pathname: window.location.pathname,
    }));
  expect(location).toEqual({
    host: new URL(fixture.url).origin,
    origin: fixture.liveOrigin,
    pathname: "/static/screens/home.desktop.html",
  });
  const count = liveFrame(page, "desktop").locator("#count");
  await expect(count).toHaveText("Home: 0");
  await liveFrame(page, "desktop").locator("#increment").click();
  await expect(count).toHaveText("Home: 1");
});

test("a link inside a Live frame opens its destination in the shell", async ({
  page,
}) => {
  fixture.gate.open();
  await open(page, "screens/home.html");
  await previewMode(page).getByRole("button", { name: "Live" }).click();
  await expectLiveReady(page);
  await liveFrame(page, "desktop").locator("#details-link").click();
  await expect(page).toHaveURL(/\/view\/screens\/details\.html$/);
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expectLive(page);
  await expectLiveReady(page);
  await expect(liveFrame(page, "desktop").locator("#details")).toHaveText(
    "Current details",
  );
});

test("the preview mode follows view changes and resets with the document", async ({
  page,
}) => {
  fixture.gate.open();
  await open(page, "screens/home.html");
  await previewMode(page).getByRole("button", { name: "Live" }).click();
  await expectLive(page);
  await page.locator('a[data-route="components/counter.html"]').click();
  await expect(page.locator("#mb-main h2")).toHaveText("Counter");
  await expectLive(page);
  await expectLiveReady(page);
  await expect(liveFrame(page, "mobile").locator("#count")).toHaveText(
    "Saved: 0",
  );
  await page.reload();
  await expectStatic(page);
  await expect(page.locator(".mbk-live-frame")).toHaveCount(0);
});
