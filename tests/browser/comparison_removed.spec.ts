import { expect } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import {
  awaitRoutedDetail,
  chooseFilter,
  chooseMode,
  comparisonFrames,
  comparisonIndex,
  navRow,
  snapshotOf,
} from "./comparison_ui.js";
import { historicalFrame, previousVersionLabel } from "./previous_version.js";
import { openPanelTab } from "./workspace_actions.js";

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
        ? historicalFrame(page, "desktop").locator("iframe")
        : page.locator(PREVIEW);
    const expectHistorical = async () => {
      await expect(page.locator("#mb-main h2").first()).toHaveText(title);
      await expect(previousVersionLabel(page)).toHaveText(
        "Showing previous version",
      );
      await expect(
        frame.contentFrame().getByRole("heading", { name: content }),
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
    // The shell names the removed variant and its parent, and its status.
    await awaitRoutedDetail(page, variant);
    await expect(page).toHaveTitle(new RegExp(`^${title} · `, "u"));
    await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
    // Current shows that the variant was removed, and the band offers its
    // comparison.
    const gone = page.getByRole("heading", {
      name: "This variant was removed",
      exact: true,
    });
    await expect(gone).toBeVisible();
    await openPanelTab(page, "Changes");
    await expect(
      page.getByRole("group", { name: "Comparison mode" }),
    ).toBeVisible();
    await chooseMode(page, "Side by side");
    await expect(gone).toBeHidden();
    // Side by side compares the variant's first frame: its previous version
    // beside the missing current side, worded with the design catalogue's
    // copy.
    await expect(
      page.locator('[data-mokly-stage] [data-compare-mode="side"]'),
    ).toHaveCount(2);
    await expect(comparisonFrames(page)).toHaveCount(1);
    await expect(page.locator(".mb-pane--after .mb-pane-missing")).toHaveText([
      "This variant has been removed.",
    ]);
  });
