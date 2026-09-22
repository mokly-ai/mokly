import { createHash } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  HISTORY_ENTRIES,
  startHistoricalSelectionHistory,
} from "./historical_selection_history_fixture.js";

for (const mode of ["serve", "static"] as const) {
  test.describe(`${mode} historical navigation`, () => {
    let host: Awaited<ReturnType<typeof startHistoricalSelectionHistory>>;
    test.beforeAll(async () => {
      test.setTimeout(240_000);
      host = await startHistoricalSelectionHistory(mode);
    });
    test.afterAll(async () => {
      await host?.close();
    });

    for (const entry of HISTORY_ENTRIES) {
      if (mode === "static")
        test(`${entry.kind} preserves its snapshot through provider-normalized URLs`, async ({
          page,
        }) => {
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.route(`${host.url}/view/**`, async (route) => {
            const url = new URL(route.request().url());
            if (url.pathname.endsWith(".html")) return route.continue();
            url.pathname += ".html";
            await route.fulfill({
              response: await route.fetch({ url: url.href }),
            });
          });
          const record = host.catalogue.removedEntries.find(
            ({ entry: candidate }) => candidate.id === entry.id,
          );
          expect(record?.snapshotId).toMatch(/^[a-f0-9]{64}$/);
          const previousUrl = `${host.url}/view/${entry.previousRoute.slice(0, -5)}?snapshot=${record!.snapshotId}`;
          const currentUrl = `${host.url}/view/${entry.currentRoute.slice(0, -5)}`;
          await page.goto(previousUrl);
          await expect(page.locator("html")).toHaveAttribute(
            "data-mokly-hydrated",
            "",
          );
          await expect(page).toHaveURL(previousUrl);
          await expectHistorical(page, entry);
          await page.locator('[data-filter="changed"]').click();
          await page
            .locator(`a[data-nav-row][data-route="${entry.currentRoute}"]`)
            .click();
          await expect(page).toHaveURL(currentUrl);
          await expect(page.locator("[data-mokly-preview]")).toHaveCount(0);
          await page.goBack();
          await expectHistorical(page, entry);
          await page.goForward();
          await expect(page).toHaveURL(currentUrl);
          await page.goBack();
          await page.reload();
          await expect(page).toHaveURL(previousUrl);
          await expectHistorical(page, entry);
          expect(errors).toEqual([]);

          await page.goto(`${currentUrl}?snapshot=${record!.snapshotId}`);
          await expect(page.locator("#mb-main")).not.toContainText(
            entry.currentTitle,
          );
          await expect(page.locator("[data-mokly-preview] iframe")).toHaveCount(
            0,
          );
          await expect(
            page.locator("iframe[data-workspace-frame]"),
          ).toHaveCount(0);
        });

      test(`${entry.kind} keeps its historical identity through Back, Forward and refresh`, async ({
        page,
      }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const snapshotId = createHash("sha256")
          .update(
            JSON.stringify([
              "mokly-historical-snapshot-v1",
              host.catalogue.identity.id,
              "baseline",
              host.baseCommit,
              entry.kind,
              entry.id,
              entry.previousRoute,
            ]),
          )
          .digest("hex");
        const previousUrl = `${host.url}/view/${entry.previousRoute}?snapshot=${snapshotId}`;
        const currentUrl = `${host.url}/view/${entry.currentRoute}`;
        await page.goto(currentUrl);
        await expect(page.locator("html")).toHaveAttribute(
          "data-mokly-hydrated",
          "",
        );
        await expect(page.locator("#mb-main h2")).toHaveText(
          entry.currentTitle,
        );
        await page.locator('[data-filter="changed"]').click();
        await page
          .locator(`a[data-nav-row][data-route="${entry.previousRoute}"]`)
          .click();
        await expect(page).toHaveURL(previousUrl);
        await expectHistorical(page, entry);
        await page
          .locator(`a[data-nav-row][data-route="${entry.currentRoute}"]`)
          .click();
        await expect(page).toHaveURL(currentUrl);
        await expect(page.locator("#mb-main h2")).toHaveText(
          entry.currentTitle,
        );
        await expect(page.locator("[data-mokly-preview]")).toHaveCount(0);

        await page.goBack();
        await expect(page).toHaveURL(previousUrl);
        await expectHistorical(page, entry);
        await page.goForward();
        await expect(page).toHaveURL(currentUrl);
        await expect(page.locator("#mb-main h2")).toHaveText(
          entry.currentTitle,
        );
        await page.goBack();
        await page.reload();
        await expect(page).toHaveURL(previousUrl);
        await expectHistorical(page, entry);
        expect(errors).toEqual([]);

        await page.goto(`${currentUrl}?snapshot=${snapshotId}`);
        await expect(page.locator("[data-mokly-preview] iframe")).toHaveCount(
          0,
        );
        await expect(page.locator("iframe[data-workspace-frame]")).toHaveCount(
          0,
        );
        await expect(page.locator("#mb-main")).not.toContainText(
          entry.currentTitle,
        );
      });
    }
  });
}

async function expectHistorical(
  page: Page,
  entry: (typeof HISTORY_ENTRIES)[number],
): Promise<void> {
  await expect(page.locator("#mb-main h2")).toHaveText(entry.previousTitle);
  await expect(page.locator(".mbk-previous")).toHaveText(
    "Showing previous version",
  );
  await expect(
    page.locator(`a[data-nav-row][data-route="${entry.previousRoute}"]`),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".mbk-diff-toolbar")).toHaveCount(0);
  await expect(page.locator("iframe[data-workspace-frame]")).toHaveCount(0);
  if (entry.kind === "screen") {
    await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
    for (const viewport of ["mobile", "desktop"] as const)
      await expect(
        page
          .frameLocator(`[data-mokly-preview] .mbk-frame-${viewport} iframe`)
          .locator("h1"),
      ).toHaveText(`Previous ${viewport} screen`);
    await expect(page.locator("[data-workspace-highlight]")).toBeDisabled();
  } else {
    await expect(page.locator(".mbk-entry-status")).toHaveText("Removed");
    await expect(
      page.frameLocator("[data-mokly-preview] iframe").locator("h1"),
    ).toHaveText("Previous page content");
  }
}
