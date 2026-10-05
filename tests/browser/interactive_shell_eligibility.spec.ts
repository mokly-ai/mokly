import { expect, test, type Page } from "@playwright/test";

import { entryRoute, viewHref } from "@mokly/viewer/data";

import { interactiveShellFixture } from "./interactive_shell_fixture.js";
import {
  expectLive,
  expectLiveReady,
  expectStaticFrames,
  liveFrame,
  previewMode,
  recordLiveRequests,
} from "./interactive_shell_helpers.js";
import { chooseVariant } from "./workspace_actions.js";

const NOTICE = "Switch to Static to inspect or edit this view.";

let fixture: Awaited<ReturnType<typeof interactiveShellFixture>>;

test.beforeAll(async () => {
  fixture = await interactiveShellFixture();
  fixture.gate.open();
});

test.afterAll(async () => {
  await fixture?.close();
});

async function open(page: Page, route: string): Promise<void> {
  await page.goto(`${fixture.url}/view/${route.replace(/index\.html$/, "")}`);
  await expect(page.locator("html")).toHaveAttribute("data-mokly-react-shell");
}

async function navigate(page: Page, route: string, heading: string) {
  await page.locator(`a[data-nav-row][data-route="${route}"]`).click();
  await expect(page.locator("#mb-main h2")).toHaveText(heading);
}

function panel(page: Page, name: string) {
  return page.getByRole("tabpanel", { name, exact: true });
}

test("opted-out screens and components keep their toolbar without Static and Live", async ({
  page,
}) => {
  const seen = recordLiveRequests(page, fixture.liveOrigin!);
  for (const [route, heading, eligible] of [
    [entryRoute("home"), "Home", true],
    [entryRoute("notes"), "Notes", false],
    [entryRoute("counter"), "Counter", true],
    [entryRoute("badge"), "Badge", false],
  ] as const) {
    const served = await page.request.get(
      `${fixture.url}/view/${route.replace(/index\.html$/, "")}`,
    );
    expect((await served.text()).includes('aria-label="Preview mode"')).toBe(
      eligible,
    );
    await open(page, route);
    await expect(page.locator("#mb-main h2")).toHaveText(heading);
    const tools = page.getByRole("group", { name: "View options" });
    await expect(
      tools.getByRole("combobox", { name: "Viewport", exact: true }),
    ).toBeVisible();
    await expect(
      tools.getByRole("button", { name: "Highlight components", exact: true }),
    ).toBeVisible();
    await expect(previewMode(page)).toHaveCount(eligible ? 1 : 0);
    await expect(tools.locator(":scope > *")).toHaveCount(eligible ? 3 : 2);
    await expectStaticFrames(page);
  }
  expect(seen.documents).toEqual([]);
});

test("Live follows eligible views while opted-out screens and components stay Static", async ({
  page,
}) => {
  const seen = recordLiveRequests(page, fixture.liveOrigin!);
  await open(page, entryRoute("home"));
  await previewMode(page).getByRole("button", { name: "Live" }).click();
  await expectLiveReady(page);

  await navigate(page, entryRoute("notes"), "Notes");
  await expect(previewMode(page)).toHaveCount(0);
  await expectStaticFrames(page);
  const staticDesktop = page.frameLocator(
    'iframe[data-workspace-frame="desktop"]',
  );
  await expect(staticDesktop.locator("#count")).toHaveText("Notes: 0");
  await page.getByRole("tab", { name: "Components", exact: true }).click();
  await expect(panel(page, "Components")).not.toHaveText(NOTICE);

  await navigate(page, entryRoute("counter"), "Counter");
  await expectLive(page);
  await expectLiveReady(page);
  await expect(liveFrame(page, "desktop").locator("#count")).toHaveText(
    "Saved: 0",
  );

  await navigate(page, entryRoute("badge"), "Badge");
  await expect(previewMode(page)).toHaveCount(0);
  await expectStaticFrames(page);
  await page.getByRole("tab", { name: "Props", exact: true }).click();
  await expect(page.getByLabel("Label", { exact: true })).toHaveValue("Badge");
  await chooseVariant(page, "Quiet");
  await expect(page).toHaveURL(
    new URL(viewHref("badge/quiet"), fixture.url).href,
  );
  await expect(staticDesktop.locator("#count")).toHaveText("Quiet: 0");
  await expectStaticFrames(page);
  await expect(previewMode(page)).toHaveCount(0);

  await page.goBack();
  await page.goBack();
  await expect(page.locator("#mb-main h2")).toHaveText("Counter");
  await expectLive(page);
  await expectLiveReady(page);

  await navigate(page, entryRoute("home"), "Home");
  await expectLive(page);
  await expectLiveReady(page);
  await liveFrame(page, "desktop").locator("#increment").click();
  await expect(liveFrame(page, "desktop").locator("#count")).toHaveText(
    "Home: 1",
  );
  expect(seen.documents.filter((path) => /notes|badge/.test(path))).toEqual([]);
});

test("route evidence that cannot load leaves the view Static without the control", async ({
  page,
}) => {
  const seen = recordLiveRequests(page, fixture.liveOrigin!);
  await open(page, entryRoute("home"));
  await previewMode(page).getByRole("button", { name: "Live" }).click();
  await expectLiveReady(page);
  let fetches = 0;
  const detailsHref = viewHref("details");
  await page.route(`**${detailsHref}`, (route) =>
    route.request().resourceType() === "fetch"
      ? ((fetches += 1), route.abort())
      : route.continue(),
  );

  await navigate(page, entryRoute("details"), "Details");
  await expect.poll(() => fetches).toBeGreaterThan(0);
  await expect(previewMode(page)).toHaveCount(0);
  await expectStaticFrames(page);
  expect(seen.documents.filter((path) => path.includes("details"))).toEqual([]);

  await page.unroute(`**${detailsHref}`);
  await navigate(page, entryRoute("counter"), "Counter");
  await expectLive(page);
  await expectLiveReady(page);
});
