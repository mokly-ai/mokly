import { expect, test, type Page } from "@playwright/test";

import {
  expectLive,
  expectLiveReady,
  liveFrame,
  previewMode,
} from "./interactive_shell_helpers.js";
import {
  watchedRebuildServe,
  type WatchedRebuildServe,
} from "./rebuild_status_fixture.js";
import {
  COPY,
  detail,
  expectReceived,
  failureAnnouncements,
  hydrated,
  instrument,
  notice,
  progress,
  readLog,
  summary,
} from "./rebuild_status_page.js";

let serve: WatchedRebuildServe;

/** Stop the page's timers a moment from now; only the test advances them. */
async function freezeClock(page: Page): Promise<void> {
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 250));
}

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

test("a failed save keeps the last working version in Static and Live", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await instrument(page);
  await page.goto(`${serve.url}/view/home/`);
  await hydrated(page);
  await expect(notice(page)).toHaveCount(0);
  await previewMode(page).getByRole("button", { name: "Live" }).click();
  await expectLiveReady(page);
  const count = liveFrame(page, "desktop").locator("#count");
  await liveFrame(page, "desktop").locator("#increment").click();
  await expect(count).toHaveText("Home: 1");

  await serve.save(serve.sources.broken);
  await expect(notice(page)).toBeVisible({ timeout: 60_000 });
  await expect(notice(page)).toContainText(
    `${COPY.headline} ${COPY.explanation}`,
  );
  await expectLive(page);
  await liveFrame(page, "desktop").locator("#increment").click();
  await expect(count, "Live keeps working on the last version").toHaveText(
    "Home: 2",
  );
  await expect.poll(() => failureAnnouncements(page)).toBe(1);
  await expect(page.locator("#mb-status")).toHaveText(
    `${COPY.headline} ${COPY.explanation}`,
  );

  await previewMode(page).getByRole("button", { name: "Static" }).click();
  await expect(
    page.frameLocator("iframe[data-workspace-frame]").first().locator("#count"),
    "Static keeps the last working content",
  ).toHaveText("Home: 0");
  await expect(notice(page)).toBeVisible();

  await expect(summary(page)).toHaveAccessibleName(COPY.show);
  await expect(detail(page)).toHaveCount(0);
  await summary(page).click();
  await expect(summary(page)).toHaveAccessibleName(COPY.hide);
  await expect(detail(page)).toContainText(
    'Unexpected closing "h2" tag does not match opening "p" tag',
  );
  await expect(detail(page)).toContainText("entries/fixture.mockup.tsx");
  expect(await detail(page).textContent()).not.toContain(serve.fixture.root);
  await summary(page).click();
  await expect(detail(page)).toHaveCount(0);

  await serve.gate.arm();
  await serve.save(serve.sources.held("fail"));
  await serve.gate.entered();
  await expect(progress(page)).toHaveText(COPY.progress, { timeout: 15_000 });
  await expect(notice(page), "progress keeps the notice").toBeVisible();
  const log = await readLog(page);
  const started = log.rebuild.find(
    ({ status }) => status.updating && status.failure !== null,
  );
  const shown = log.progress.find(({ visible }) => visible);
  expect(started && shown).toBeTruthy();
  expect(shown!.at - started!.at).toBeGreaterThanOrEqual(1_000);

  await serve.gate.release();
  await expect(progress(page)).toHaveCount(0, { timeout: 60_000 });
  await summary(page).click();
  await expect(detail(page)).toContainText(
    "The held change could not be loaded.",
  );
  await expect.poll(() => failureAnnouncements(page)).toBe(2);

  await serve.save(serve.sources.current);
  await expect(notice(page), "the reload clears the notice").toHaveCount(0, {
    timeout: 60_000,
  });
  await hydrated(page);
  await expect(page.locator("#mb-status")).not.toHaveText(
    `${COPY.headline} ${COPY.explanation}`,
  );
});

test("an update that finishes within a second never shows progress", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await instrument(page);
  await page.clock.install();
  await page.goto(`${serve.url}/view/details/`);
  await hydrated(page);
  await freezeClock(page);
  await serve.save(serve.sources.broken);
  await expect(notice(page)).toBeVisible({ timeout: 60_000 });
  await expectReceived(page, (status) => status.updating);
  await expectReceived(page, (status) => !status.updating && !!status.failure);
  await page.clock.runFor(5_000);
  await expect(progress(page)).toHaveCount(0);
  expect((await readLog(page)).progress).toEqual([]);
  await page.clock.resume();
});

test("progress appears exactly one second after updating begins", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await instrument(page);
  await page.clock.install();
  await page.goto(`${serve.url}/view/details/`);
  await hydrated(page);
  await freezeClock(page);
  await serve.gate.arm();
  await serve.save(serve.sources.held("load"));
  await serve.gate.entered();
  await expectReceived(page, (status) => status.updating);
  await page.waitForTimeout(500);
  await page.clock.runFor(999);
  await expect(progress(page)).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(progress(page)).toHaveText(COPY.progress);
  await expect(notice(page)).toHaveCount(0);
  await page.clock.resume();
  await serve.gate.release();
});

test("a page opened during an update starts the delay when it hydrates", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await serve.gate.arm();
  await serve.save(serve.sources.held("load"));
  await serve.gate.entered();
  await serve.waitForStatus((status) => status.updating);
  const route = `${serve.url}/view/details/`;
  const served = await (await fetch(route)).text();
  expect(served, "first paint never shows progress").not.toContain(
    "mbk-progress",
  );
  expect(served).toContain('<div class="mbk-search-slot">');
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1_000);
  await page.goto(route);
  await hydrated(page);
  await page.waitForTimeout(500);
  await page.clock.runFor(999);
  await expect(progress(page)).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(progress(page)).toHaveText(COPY.progress);
  await page.clock.resume();
  await serve.gate.release();
});
