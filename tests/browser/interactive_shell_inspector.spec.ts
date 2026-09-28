import { expect, test, type Page } from "@playwright/test";

import { interactiveShellFixture } from "./interactive_shell_fixture.js";
import {
  expectLive,
  expectLiveReady,
  expectStatic,
  liveFrame,
  previewMode,
} from "./interactive_shell_helpers.js";

const NOTICE = "Switch to Static to inspect or edit this view.";
const HIGHLIGHT = "Highlighting works in Static.";

let fixture: Awaited<ReturnType<typeof interactiveShellFixture>>;
let staticOnly: Awaited<ReturnType<typeof interactiveShellFixture>>;

test.beforeAll(async () => {
  fixture = await interactiveShellFixture();
  fixture.gate.open();
  staticOnly = await interactiveShellFixture("off");
});

test.afterAll(async () => {
  await fixture?.close();
  await staticOnly?.close();
});

async function open(page: Page, url: string, route: string): Promise<void> {
  await page.goto(`${url}/view/${route}`);
  await expect(page.locator("html")).toHaveAttribute("data-mokly-react-shell");
}

test("Live points inspection back to Static and discards unsaved edits", async ({
  page,
}) => {
  await open(page, fixture.url, "components/counter.html");
  await page.getByRole("tab", { name: "Props", exact: true }).click();
  const label = page.getByLabel("Label", { exact: true });
  await expect(label).toHaveValue("Saved");
  await label.fill("Edited");
  const staticFrame = page.frameLocator(
    'iframe[data-workspace-frame="desktop"]',
  );
  await expect(staticFrame.locator("#count")).toHaveText("Edited: 0");

  await previewMode(page).getByRole("button", { name: "Live" }).click();
  await expectLive(page);
  const panel = (name: string) =>
    page.getByRole("tabpanel", { name, exact: true });
  await expect(panel("Props")).toHaveText(NOTICE);
  await expect(label).toHaveCount(0);
  const highlight = page.getByRole("button", {
    name: "Highlight components",
    exact: true,
  });
  await expect(highlight).toBeDisabled();
  await expect(highlight).toHaveAttribute("title", HIGHLIGHT);
  await expect(highlight).toHaveAccessibleDescription(HIGHLIGHT);
  for (const tab of ["Usage", "Nested components"]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await expect(panel(tab)).toHaveText(NOTICE);
  }
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(panel("Details")).toContainText(
    "A counter that remembers clicks",
  );
  await expectLiveReady(page);
  await expect(liveFrame(page, "desktop").locator("#count")).toHaveText(
    "Saved: 0",
  );

  await previewMode(page).getByRole("button", { name: "Static" }).click();
  await page.getByRole("tab", { name: "Props", exact: true }).click();
  await expect(label).toHaveValue("Saved");
  await expect(staticFrame.locator("#count")).toHaveText("Saved: 0");
  await expect(highlight).not.toHaveAttribute("title", HIGHLIGHT);

  await page.locator('a[data-route="screens/home.html"]').click();
  await expect(page.locator("#mb-main h2")).toHaveText("Home");
  await previewMode(page).getByRole("button", { name: "Live" }).click();
  await page.getByRole("tab", { name: "Components", exact: true }).click();
  await expect(panel("Components")).toHaveText(NOTICE);
});

test("the preview mode control is operable from the keyboard", async ({
  page,
}) => {
  await open(page, fixture.url, "screens/home.html");
  const group = previewMode(page);
  const staticButton = group.getByRole("button", { name: "Static" });
  const liveButton = group.getByRole("button", { name: "Live" });
  await expect(staticButton).toHaveAttribute(
    "title",
    "Show the static preview",
  );
  await expect(liveButton).toHaveAttribute(
    "title",
    "Interact with the live preview",
  );
  await page.getByRole("combobox", { name: "Viewport", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(staticButton).toBeFocused();
  await expect(staticButton).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Tab");
  await expect(liveButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expectLive(page);
  await expectLiveReady(page);
  await page.keyboard.press("Shift+Tab");
  await expect(staticButton).toBeFocused();
  await page.keyboard.press("Space");
  await expectStatic(page);
  await expect(page.locator(".mbk-live-frame")).toHaveCount(0);
});

test("an unreachable Live document returns that view to Static", async ({
  page,
}) => {
  await page.route(`${fixture.liveOrigin}/static/**`, (route) =>
    route.fulfill({
      body: "Not found",
      contentType: "text/plain",
      status: 404,
    }),
  );
  await open(page, fixture.url, "screens/details.html");
  const live = previewMode(page).getByRole("button", { name: "Live" });
  await live.click();
  await expect(page.locator(".mbk-live-preparing")).toHaveCount(2);
  await expect(live).toHaveAttribute("aria-disabled", "true", {
    timeout: 15_000,
  });
  await expectStatic(page);
  await expect(page.locator(".mbk-live-frame")).toHaveCount(0);
  await expect(
    page.locator('iframe[data-workspace-frame="desktop"]'),
  ).toBeVisible();
  await page.locator('a[data-route="screens/home.html"]').click();
  await expect(page.locator("#mb-main h2")).toHaveText("Home");
  await expect(live).not.toHaveAttribute("aria-disabled");
  await expectStatic(page);
});

test("a static-only catalogue keeps its toolbar without Static and Live", async ({
  page,
}) => {
  expect(staticOnly.liveOrigin).toBeUndefined();
  for (const [route, heading] of [
    ["screens/home.html", "Home"],
    ["components/counter.html", "Counter"],
  ] as const) {
    await open(page, staticOnly.url, route);
    await expect(page.locator("#mb-main h2")).toHaveText(heading);
    const tools = page.getByRole("group", { name: "View options" });
    await expect(
      tools.getByRole("combobox", { name: "Viewport", exact: true }),
    ).toBeVisible();
    await expect(
      tools.getByRole("button", { name: "Highlight components", exact: true }),
    ).toBeVisible();
    await expect(previewMode(page)).toHaveCount(0);
  }
});
