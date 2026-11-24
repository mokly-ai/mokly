/**
 * The right panel and the sheets of the compact layout in a browser spec:
 * the dock's controls, the panel's tabs, Inspect and Changes, and the
 * reveal of a control that the panel holds.
 */

import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Close the open sheet of the compact layout, if one is open: the dock hides
 * while a sheet is open, and a sheet covers the canvas below it.
 */
export async function closeOpenSheet(scope: Page | Locator): Promise<void> {
  for (const name of ["Close panel", "Close catalogue"]) {
    const close = scope.getByRole("button", { name, exact: true });
    if (await close.isVisible()) await close.click();
  }
}

/**
 * Open the compact layout's catalogue sheet with the dock's Catalogue, in a
 * page or in one viewer root, after closing the panel's sheet.
 */
export async function openCatalogueSheet(scope: Page | Locator): Promise<void> {
  await closeOpenSheet(scope);
  await scope
    .getByRole("group", { name: "Canvas controls" })
    .getByRole("button", { name: "Catalogue" })
    .click();
}

/** The dock's control of the right panel, which names the panel's current tab. */
function dockTab(scope: Page | Locator): Locator {
  return scope
    .getByRole("group", { name: "Canvas controls" })
    .getByRole("button", { name: /^(?:Inspect|Changes)$/u });
}

/**
 * Open the compact layout's panel sheet with the dock's current tab, after
 * closing the catalogue's sheet.
 */
export async function openPanelSheet(scope: Page | Locator): Promise<void> {
  await closeOpenSheet(scope);
  await dockTab(scope).click();
}

/**
 * Select a tab of the right panel, Inspect or Changes, after opening the
 * panel's sheet in the compact layout.
 */
export async function openPanelTab(
  scope: Page | Locator,
  name: "Inspect" | "Changes",
): Promise<void> {
  const tab = scope.getByRole("tab", { name, exact: true });
  await revealInPanel(scope, tab);
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

/**
 * Open one of Inspect's folded sections, Props, Usage or Components, and
 * return its content; a press on an open section's head would fold it.
 */
export async function openInspectFold(
  scope: Page | Locator,
  name: "components" | "props" | "usage",
): Promise<Locator> {
  const section = scope.locator(`[data-inspect-section="${name}"]`);
  const head = section.locator(":scope > summary");
  await revealInPanel(scope, head);
  if ((await section.getAttribute("open")) === null) await head.click();
  await expect(section).toHaveAttribute("open", "");
  return section.locator(":scope > .mbk-inspect-fold-body");
}

/**
 * Show a control of the right panel: in the compact layout the panel is a
 * sheet, which the dock opens while the control is hidden, and a control in
 * the tab that is not selected shows once its tab is. Until the shell renders
 * the control in a hidden tab, or shows the control or the way to it, the
 * dock's tab or the open catalogue sheet over the dock, it is still
 * rendering, so this waits.
 */
export async function revealInPanel(
  scope: Page | Locator,
  control: Locator,
): Promise<void> {
  const tab = dockTab(scope);
  const catalogue = scope.getByRole("button", {
    name: "Close catalogue",
    exact: true,
  });
  await expect
    .poll(
      async () =>
        (await control.first().isVisible()) ||
        (await tab.isVisible()) ||
        (await catalogue.isVisible()) ||
        (await hiddenBody(control)) !== undefined,
    )
    .toBe(true);
  if (await control.first().isVisible()) return;
  if ((await tab.isVisible()) || (await closeVisibleCatalogue(scope)))
    await openPanelSheet(scope);
  const body = await hiddenBody(control);
  if (body !== undefined)
    await scope.locator(`[role="tab"][aria-controls="${body}"]`).click();
}

/**
 * The id of the hidden tab body that holds the control, while the control
 * lies in the right panel's tab that is not selected.
 */
async function hiddenBody(control: Locator): Promise<string | undefined> {
  if (!(await control.count())) return undefined;
  const id = await control.first().evaluate((element) => {
    const body = element.closest('[role="tabpanel"]');
    return body?.hasAttribute("hidden") ? body.id : null;
  });
  return id ?? undefined;
}

/** Close an open catalogue sheet, and say whether one was open. */
async function closeVisibleCatalogue(scope: Page | Locator): Promise<boolean> {
  const close = scope.getByRole("button", {
    name: "Close catalogue",
    exact: true,
  });
  if (!(await close.isVisible())) return false;
  await close.click();
  return true;
}
