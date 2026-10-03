import { expect, test, type Page } from "@playwright/test";

import { loadComparison } from "./comparison_actions.js";
import {
  startMovedChanges,
  type MovedChangesHost,
} from "./moved_changes_fixture.js";

let served: MovedChangesHost;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  served = await startMovedChanges();
});

test.afterAll(async () => {
  if (served) await served.close();
});

/** The comparison panes for one side, named by the snapshot path they show. */
function panes(page: Page, side: "after" | "before", path: string) {
  return page.locator(
    `iframe[data-mokly-comparison-frame][data-mokly-preview-source*="/snapshots/${side}/${path}/"]`,
  );
}

async function expectBothSides(page: Page): Promise<void> {
  const before = panes(page, "before", "billing/invoice");
  const after = panes(page, "after", "account/billing/invoice");
  await expect(before.first()).toBeAttached();
  await expect(after.first()).toBeAttached();
  await expect(
    page.locator(
      'iframe[data-mokly-comparison-frame][data-mokly-preview-source*="/snapshots/before/account/"]',
    ),
  ).toHaveCount(0);
  await expect(before.first()).toHaveAttribute("srcdoc", /Due in 14 days/u);
  await expect(after.first()).toHaveAttribute("srcdoc", /Due on 14 March/u);
}

test("a moved screen compares with the version at its previous path in every mode", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${served.url}/view/account/billing/invoice/`);
  await expect(page.locator(".mbk-entry-status")).toHaveText("Changed");
  const modes = page.getByRole("group", { name: "Comparison mode" });
  await expect(modes.getByRole("button", { name: "Current" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("iframe[data-mokly-comparison-frame]")).toHaveCount(
    0,
  );
  await expect(
    page.frameLocator(".mbk-frame-mobile iframe").locator("#due"),
  ).toHaveText("Due on 14 March");

  await loadComparison(page, "Side by side");
  await expectBothSides(page);
  for (const mode of ["Overlay", "Difference"] as const) {
    await modes.getByRole("button", { name: mode, exact: true }).click();
    await expect(
      modes.getByRole("button", { name: mode, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expectBothSides(page);
  }
  await modes.getByRole("button", { name: "Current", exact: true }).click();
  await expect(page.locator("iframe[data-mokly-comparison-frame]")).toHaveCount(
    0,
  );
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(page.locator("[data-workspace-evidence]")).toContainText(
    "The previous version is at billing/invoice, where it was before the move.",
  );
});
