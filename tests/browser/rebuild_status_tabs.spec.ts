import { expect, test } from "@playwright/test";

import {
  captureBrowserErrors,
  expectCleanHydration,
} from "./react_shell_hydration_helpers.js";
import {
  watchedRebuildServe,
  type WatchedRebuildServe,
} from "./rebuild_status_fixture.js";
import {
  COPY,
  detail,
  dropStream,
  expectReceived,
  failureAnnouncements,
  hydrated,
  instrument,
  notice,
  progress,
  reconnectStream,
  summary,
} from "./rebuild_status_page.js";

let serve: WatchedRebuildServe;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  serve = await watchedRebuildServe();
});

test.afterAll(async () => {
  await serve?.close();
});

test.afterEach(async () => {
  await serve.restore();
});

test("a tab opened while failed shows the notice without announcing it", async ({
  context,
  page,
}) => {
  test.setTimeout(120_000);
  await instrument(page);
  await page.goto(`${serve.url}/view/home/`);
  await hydrated(page);
  await serve.save(serve.sources.broken);
  await expect(notice(page)).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => failureAnnouncements(page)).toBe(1);
  const failed = await serve.waitForStatus((status) => !!status.failure);
  await page
    .locator('a[data-nav-row][data-route="details/index.html"]')
    .click();
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expect(notice(page), "route changes keep the notice").toBeVisible();
  await expect(page.locator("#mb-status")).toContainText("Details");

  const second = await context.newPage();
  const errors = captureBrowserErrors(second);
  await instrument(second);
  await second.goto(`${serve.url}/view/counter/`);
  await expect(notice(second)).toBeVisible();
  await expectCleanHydration(second, errors, "a failed page hydrates cleanly");
  await expectReceived(
    second,
    (status) => status.failure?.id === failed.failure?.id,
  );
  await second.waitForTimeout(500);
  expect(await failureAnnouncements(second)).toBe(0);
  await expect(second.locator("#mb-status")).toHaveText("");
  await second.reload();
  await expect(notice(second)).toBeVisible();
  await hydrated(second);
  await second.waitForTimeout(500);
  expect(await failureAnnouncements(second), "nor on reload").toBe(0);
  expect(await failureAnnouncements(page), "nor again in the first").toBe(1);
});

test("a reconnected stream replays the current failure once", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await instrument(page);
  await page.goto(`${serve.url}/view/home/`);
  await hydrated(page);
  await expectReceived(page, (status) => status.failure === null);
  await dropStream(page);
  await serve.save(serve.sources.broken);
  const failed = await serve.waitForStatus(
    (status) => !!status.failure && !status.updating,
  );
  await page.waitForTimeout(500);
  await expect(notice(page), "nothing arrives while disconnected").toHaveCount(
    0,
  );

  await reconnectStream(page);
  await expect(notice(page)).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => failureAnnouncements(page)).toBe(1);
  await dropStream(page);
  await reconnectStream(page);
  await expectReceived(
    page,
    (status) => status.failure?.id === failed.failure?.id,
  );
  await page.waitForTimeout(500);
  expect(await failureAnnouncements(page), "a replay is not new").toBe(1);
  await expect(notice(page)).toBeVisible();
});

test("details stay open through progress and close in place when replaced", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await instrument(page);
  await page.goto(`${serve.url}/view/details/`);
  await hydrated(page);
  await serve.save(serve.sources.broken);
  await expect(notice(page)).toBeVisible({ timeout: 60_000 });

  await summary(page).focus();
  await page.keyboard.press("Enter");
  await expect(summary(page)).toHaveAccessibleName(COPY.hide);
  await expect(detail(page)).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(detail(page), "the detail is a keyboard stop").toBeFocused();

  await serve.gate.arm();
  await serve.save(serve.sources.held("fail"));
  await serve.gate.entered();
  await expect(progress(page)).toBeVisible({ timeout: 15_000 });
  await expect(
    detail(page),
    "progress keeps the same failure open",
  ).toBeFocused();
  await expect(summary(page)).toHaveAccessibleName(COPY.hide);

  await serve.gate.release();
  await expect(detail(page)).toHaveCount(0, { timeout: 60_000 });
  await expect(summary(page)).toHaveAccessibleName(COPY.show);
  await expect(
    summary(page),
    "focus stays in the notice when its detail closes",
  ).toBeFocused();
  await expect.poll(() => failureAnnouncements(page)).toBe(2);

  await page.keyboard.press("Space");
  await expect(detail(page)).toContainText(
    "The held change could not be loaded.",
  );
  await serve.save(serve.sources.current);
  await expect(notice(page)).toHaveCount(0, { timeout: 60_000 });
});
