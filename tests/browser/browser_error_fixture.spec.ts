import { expect } from "@playwright/test";

import { test } from "./browser_test.js";

test("the automatic error fixture observes every context and page with exact test allowances", async ({
  page,
  browser,
  browserErrors,
  allowBrowserError,
}) => {
  allowBrowserError({
    kind: "console",
    message: /^expected console sentinel$/,
  });
  allowBrowserError({ kind: "pageerror", message: /^expected page sentinel$/ });
  await page.setContent('<a target="_blank" href="about:blank">Popup</a>');
  const popupEvent = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Popup" }).click();
  const popup = await popupEvent;
  const extra = await browser.newContext();
  const extraPage = await extra.newPage();
  const browserPage = await browser.newPage();
  for (const target of [page, popup, extraPage, browserPage]) {
    await target.evaluate(() => console.error("expected console sentinel"));
    const error = target.waitForEvent("pageerror");
    await target.evaluate(() =>
      queueMicrotask(() => {
        throw new Error("expected page sentinel");
      }),
    );
    await error;
  }
  await popup.close();
  await extra.close();
  await browserPage.close();
  expect(
    browserErrors.filter((failure) => failure.kind === "console"),
  ).toHaveLength(4);
  expect(
    browserErrors.filter((failure) => failure.kind === "pageerror"),
  ).toHaveLength(4);
});

test("the automatic error fixture settles every page of a paused context", async ({
  page,
  context,
}) => {
  const beforePause = await context.newPage();
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
  const afterPause = await context.newPage();
  for (const target of [page, beforePause, afterPause]) {
    await target.setContent("<p>Controlled clock</p>");
    await expect(target.getByText("Controlled clock")).toBeVisible();
  }
});
