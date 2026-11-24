/**
 * Route-specific evidence in the copied comparison shell, under the shell
 * delivery and artifact path contracts. A client navigation keeps the
 * document and shows the destination's own Usage and Details. A full load at
 * each URL form that a host can serve for a route shows the same evidence
 * under the canonical address, and a later client navigation keeps that
 * document.
 */

import { expect, type Page } from "@playwright/test";

import { openChangesEvidence } from "./comparison_evidence_page.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { navRow } from "./comparison_ui.js";
import { inspectTitle } from "./inspect_head.js";
import { openInspectFold, openPanelTab } from "./workspace_actions.js";

const CARD = `/view/${comparisonPaths.component}/`;

/** Mark the loaded document, so that a later full load is seen. */
async function markDocument(page: Page): Promise<void> {
  await page.evaluate(() => Object.assign(window, { keptDocument: true }));
}

async function expectKeptDocument(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () => (window as { keptDocument?: boolean }).keptDocument,
    ),
  ).toBe(true);
}

/** Card's Usage lists the component and the three screens that its change affects. */
async function expectAffectedConsumers(page: Page): Promise<void> {
  const usage = await openInspectFold(page, "usage");
  const affected = usage.locator('[data-usage-section="affected"]');
  await expect(affected.getByRole("heading")).toHaveText(
    "Affected screens and components",
  );
  await expect(affected.getByRole("link")).toHaveText([
    "Toolbar",
    "Changed screen",
    "Consumer screen",
    "Former screen · Removed",
  ]);
}

/**
 * The changed screen's Details, in its Changes tab, name the changed
 * component that affects it.
 */
async function expectChangedComponent(page: Page): Promise<void> {
  await expect(inspectTitle(page)).toHaveText("Changed screen");
  const evidence = await openChangesEvidence(page);
  await expect(
    evidence.getByText("Changed component: Card", { exact: true }),
  ).toBeVisible();
}

test("client navigation keeps the document and shows each destination's own evidence", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.unchanged}/`);
  await expect(inspectTitle(page)).toHaveText("Stable screen");
  await markDocument(page);
  await navRow(page, comparisonPaths.component).click();
  await expect(page).toHaveURL(new RegExp(`${CARD}$`, "u"));
  await expectAffectedConsumers(page);
  await navRow(page, comparisonPaths.changed).click();
  await expectChangedComponent(page);
  await expectKeptDocument(page);
});

for (const suffix of ["", "/", "/index.html"])
  test(`a destination's evidence opens at host URL form ${suffix || "extensionless"}`, async ({
    page,
    baseURL,
  }) => {
    const form = `/view/${comparisonPaths.component}${suffix}`;
    // The host answers the canonical address with its own form.
    if (suffix !== "/")
      await page.route(`**${CARD}`, (route) =>
        route.fulfill({ status: 302, headers: { location: form } }),
      );
    const response = await page.goto(CARD);
    // The document came from the host's form; the shell shows the canonical one.
    expect(response!.url()).toBe(`${baseURL}${form}`);
    await expect(page).toHaveURL(new RegExp(`${CARD}$`, "u"));
    await expectAffectedConsumers(page);
    await markDocument(page);
    await page
      .locator('[data-usage-section="affected"]')
      .getByRole("link", { name: "Changed screen", exact: true })
      .click();
    // The link names the screen's comparison, which opens on the Changes tab.
    await expect(
      page.getByRole("tab", { name: "Changes", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    // The routed instance is the selection once its detail arrives: Inspect's
    // Selection section names its component.
    await openPanelTab(page, "Inspect");
    await expect(
      page
        .locator('[data-inspect-section="selection"]')
        .getByRole("link", { name: "Card", exact: true }),
    ).toBeVisible();
    await expectChangedComponent(page);
    await expectKeptDocument(page);
  });
