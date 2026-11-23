/**
 * A removed entry's previous version in the compact layout, on the copied
 * comparison output: a removed screen shows the historical frame of the
 * selection's viewport and scheme alone, which the entry bar's picker picks,
 * and the entry bar names the previous version while it shows. While the
 * canvas holds the previous version's loading or failure state in place of
 * its section, the dock has no Fit.
 */

import { expect, type Page } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import { comparisonIndex, snapshotOf } from "./comparison_ui.js";
import { PREVIOUS } from "./previous_version.js";
import { responseFailure } from "./shell_error_allowances.js";

test.use({ viewport: { width: 390, height: 844 } });

function entryBar(page: Page) {
  return page.locator("[data-entry-bar]");
}

function fit(page: Page) {
  return page
    .getByRole("group", { name: "Canvas controls" })
    .getByRole("button", { name: "Fit" });
}

/** The quiet label that the entry bar shows while the previous version does. */
function quietLabel(page: Page) {
  return entryBar(page).getByText(/^Showing previous version/u);
}

test("a removed screen shows one historical frame, which the picker picks, and the entry bar names it", async ({
  page,
  request,
  baseURL,
}) => {
  const path = comparisonPaths.removedScreen;
  const snapshot = snapshotOf(await comparisonIndex(request, baseURL), path);
  await page.goto(`/view/${path}/?snapshot=${snapshot}`);
  const shown = page.locator(PREVIOUS).getByRole("figure");
  const slug = path.split("/").at(-1)!;
  await expect(shown).toHaveCount(1);
  await expect(shown).toHaveAccessibleName(
    new RegExp(`^${slug} · Mobile · Light`, "u"),
  );
  await expect(entryBar(page).locator(".mbk-entry-status")).toHaveText(
    "Removed",
  );
  await expect(quietLabel(page)).toHaveText("Showing previous version");
  await expect(fit(page)).toBeVisible();
  const picker = entryBar(page).getByRole("combobox", { name: "Frame" });
  await expect(picker).toHaveValue("mobile-light");
  await picker.selectOption({ label: "Desktop · Light" });
  await expect(picker).toHaveValue("desktop-light");
  await expect(shown).toHaveCount(1);
  await expect(shown).toHaveAccessibleName(
    new RegExp(`^${slug} · Desktop · Light`, "u"),
  );
});

/** The site path of the removed page's previous document. */
async function retiredPage(
  request: Parameters<typeof comparisonIndex>[0],
  baseURL: string | undefined,
) {
  const index = await comparisonIndex(request, baseURL);
  const path = comparisonPaths.removedPage;
  return {
    address: `/view/${path}/?snapshot=${snapshotOf(index, path)}`,
    document: `/${index.comparisonUrl}snapshots/before/mokly-generated/${path}/index.html`,
  };
}

test("while the previous version loads, the dock has no Fit and the entry bar names no previous version", async ({
  page,
  request,
  baseURL,
}) => {
  const { address, document } = await retiredPage(request, baseURL);
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**${document}`, async (route) => {
    await held;
    await route.continue().catch(() => undefined);
  });
  try {
    await page.goto(address);
    await expect(page.getByText("Loading previous version…")).toBeVisible();
    await expect(
      page
        .getByRole("group", { name: "Canvas controls" })
        .getByRole("button", { name: "Catalogue" }),
    ).toBeVisible();
    await expect(fit(page)).toHaveCount(0);
    await expect(entryBar(page).locator(".mbk-entry-status")).toHaveText(
      "Removed",
    );
    await expect(quietLabel(page)).toHaveCount(0);
    release();
    await expect(
      page
        .frameLocator("iframe[data-mokly-preview-frame]")
        .getByRole("heading", { name: "Historical page" }),
    ).toBeVisible();
    await expect(fit(page)).toBeVisible();
    await expect(quietLabel(page)).toHaveText("Showing previous version");
  } finally {
    release();
  }
});

test("while the previous version is unavailable, the dock has no Fit and the entry bar names no previous version", async ({
  page,
  request,
  baseURL,
  allowBrowserError,
}) => {
  const { address, document } = await retiredPage(request, baseURL);
  allowBrowserError(responseFailure(baseURL!, document, 503));
  await page.route(`**${document}`, (route) =>
    route.fulfill({ status: 503, body: "" }),
  );
  await page.goto(address);
  await expect(
    page.getByRole("heading", { name: "Previous version unavailable" }),
  ).toBeVisible();
  await expect(fit(page)).toHaveCount(0);
  await expect(quietLabel(page)).toHaveCount(0);
});
