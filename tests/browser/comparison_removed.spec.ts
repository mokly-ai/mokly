import { expect } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import {
  chooseFilter,
  comparisonIndex,
  navRow,
  snapshotOf,
} from "./comparison_ui.js";

const PREVIEW = "iframe[data-mokly-preview-frame]";
const DOCUMENT_ICON = '.mbk-nav-ico path[d="M9 13h6M9 17h4"]';

test("a removed document is a Changes-only row with the document icon", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.changed}/`);
  const removed = navRow(page, comparisonPaths.removedDocument);
  await expect(removed).toBeHidden();
  await page.fill("[data-mokly-search]", "retired");
  await expect(removed).toBeHidden();
  await page.fill("[data-mokly-search]", "");
  await chooseFilter(page, "changed");
  await expect(removed).toBeVisible();
  await expect(removed).toHaveAttribute("data-entry-kind", "document");
  await expect(removed).toHaveAccessibleName(/^Retired document · Removed/u);
  await expect(removed.locator(DOCUMENT_ICON)).toHaveCount(1);
  await page.fill("[data-mokly-search]", "retired");
  await expect(removed).toBeVisible();
});

for (const [kind, removedPath, title, content] of [
  [
    "screen",
    comparisonPaths.removedScreen,
    "Retired screen",
    "Historical screen",
  ],
  ["page", comparisonPaths.removedPage, "Retired page", "Historical page"],
] as const)
  test(`${kind} keeps its historical identity through Back, Forward and refresh`, async ({
    page,
    request,
    baseURL,
  }) => {
    const snapshot = snapshotOf(
      await comparisonIndex(request, baseURL),
      removedPath,
    );
    const previous = new RegExp(
      `/view/${removedPath}/\\?snapshot=${snapshot}$`,
    );
    const current = new RegExp(`/view/${comparisonPaths.changed}/$`);
    const frame =
      kind === "screen"
        ? "[data-mokly-preview] .mbk-frame-desktop iframe"
        : PREVIEW;
    const expectHistorical = async () => {
      await expect(page.locator("#mb-main h2").first()).toHaveText(title);
      await expect(page.locator(".mbk-previous")).toHaveText(
        "Showing previous version",
      );
      await expect(
        page.frameLocator(frame).getByRole("heading", { name: content }),
      ).toBeVisible();
    };
    const expectCurrent = async () => {
      await expect(page.locator("#mb-main h2").first()).toHaveText(
        "Changed screen",
      );
      await expect(page.locator("[data-mokly-preview]")).toHaveCount(0);
    };
    await page.goto(`/view/${comparisonPaths.changed}/`);
    await chooseFilter(page, "changed");
    await navRow(page, removedPath).click();
    await expect(page).toHaveURL(previous);
    await expectHistorical();
    await navRow(page, comparisonPaths.changed).click();
    await expect(page).toHaveURL(current);
    await expectCurrent();

    await page.goBack();
    await expect(page).toHaveURL(previous);
    await expectHistorical();
    await page.goForward();
    await expect(page).toHaveURL(current);
    await expectCurrent();
    await page.goBack();
    await page.reload();
    await expect(page).toHaveURL(previous);
    await expectHistorical();
  });

for (const changed of [false, true])
  test(`removed component variants keep eligible comparisons from ${changed ? "a changed" : "an unchanged"} parent`, async ({
    page,
  }) => {
    const [parent, variant, title] = changed
      ? [comparisonPaths.component, comparisonPaths.removedVariant, "Archived"]
      : [comparisonPaths.quietParent, comparisonPaths.quietRemoved, "Old tag"];
    await page.goto(`/view/${parent}/`);
    await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
      "both",
    );
    await chooseFilter(page, "changed");
    const removed = navRow(page, variant);
    await expect(removed).toHaveAttribute(
      "href",
      new RegExp(`/view/${variant}/\\?snapshot=[a-f0-9]{64}$`),
    );
    await removed.click();
    await expect(page).toHaveURL(
      new RegExp(`/view/${variant}/\\?snapshot=[a-f0-9]{64}$`),
    );
    await expect(page.locator("[data-workspace-variant-status]")).toHaveText(
      `${title} · Removed`,
    );
    // Arriving from Changes opens the first changed view of a quiet parent.
    await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
      changed ? "both" : "mobile",
    );
    await expect(page.locator(".mbk-diff-toolbar")).toBeVisible();
    await page.getByRole("button", { name: "Side by side" }).click();
    await expect(page.locator("[data-current-screen]")).toBeHidden();
    await expect(page.locator("[data-diff-stage]")).toBeVisible();
    // Each shown viewport keeps its previous version and a missing side,
    // worded with the design catalogue's copy.
    const panes = changed ? 2 : 1;
    await expect(page.locator("[data-diff-stage] iframe")).toHaveCount(panes);
    await expect(page.locator(".mb-pane--after .mb-pane-missing")).toHaveText(
      Array.from({ length: panes }, () => "This variant has been removed."),
    );
  });
