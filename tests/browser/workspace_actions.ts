import { expect, type Page, type Locator } from "@playwright/test";

/**
 * Choose an appearance. A standalone document has one Appearance control that
 * sets the interface and the previews together; an embedded root keeps its own
 * preview switch, so both are supported here.
 */
export async function chooseScheme(
  page: Page,
  value: "light" | "dark",
): Promise<void> {
  await expect(
    page
      .locator(
        "[data-mokly-appearance-select], [data-workspace-scheme], [data-color-scheme-option]",
      )
      .first(),
  ).toBeAttached();
  const appearance = page.locator("[data-mokly-appearance-select]");
  if (await appearance.count()) {
    await appearance.selectOption(value);
    return;
  }
  // An embedded root's preview control stands in the right panel's head.
  const toggle = page.locator("[data-workspace-scheme]");
  if (await toggle.count()) {
    await revealInPanel(page, toggle);
    if (
      (await toggle.getAttribute("aria-pressed")) !== String(value === "dark")
    )
      await toggle.click();
  } else {
    const segment = page.locator(`[data-color-scheme-option="${value}"]`);
    await revealInPanel(page, segment.first());
    await page.locator(`[data-color-scheme-option="${value}"]:visible`).click();
  }
}
export async function chooseViewport(
  page: Page,
  value: "mobile" | "desktop" | "both",
): Promise<void> {
  const select = page.getByLabel("Viewport", { exact: true });
  await revealInPanel(page, select);
  await select.selectOption(value);
}
/** Navigate through the workspace's entry-backed saved-variant bar. */
export async function chooseVariant(page: Page, title: string): Promise<void> {
  const link = page
    .getByRole("navigation", { name: "Saved variants" })
    .getByRole("link", { name: title, exact: true });
  await revealInPanel(page, link);
  await link.click();
}
export async function expectFrameSource(
  frame: Locator,
  source: RegExp | string,
): Promise<void> {
  const value = () =>
    frame.evaluate((element: HTMLIFrameElement) => {
      try {
        return element.contentWindow?.location.href ?? element.src;
      } catch {
        return element.src;
      }
    });
  if (typeof source === "string") await expect.poll(value).toBe(source);
  else await expect.poll(value).toMatch(source);
}

/**
 * The selector of one canvas frame of the routed screen or component, by its
 * viewport and its own scheme: from 900px wide, a screen shows Desktop beside
 * Mobile in Light and Dark, and a component its rows of desktop frames.
 */
export function canvasFrame(
  viewport: "desktop" | "mobile",
  scheme: "dark" | "light" = "light",
): string {
  return `iframe[data-workspace-frame="${viewport}"][data-workspace-color-scheme="${scheme}"]`;
}

/**
 * The selector of a viewport's frame in either layout: the canvas's Light
 * frame from 900px wide, or below it the compact layout's one shown frame of
 * the viewport, which shows the preview scheme.
 */
export function viewportFrame(viewport: "desktop" | "mobile"): string {
  const frame = `iframe[data-workspace-frame="${viewport}"]`;
  return [
    `.mbk-canvas-section:not([data-canvas-compact]) ${frame}:not([data-workspace-color-scheme="dark"])`,
    `.mbk-canvas-section[data-canvas-compact] .mbk-canvas-cell:not([hidden]) ${frame}`,
  ].join(", ");
}

/**
 * Expect the canvas to keep a chosen viewport: the Viewport control holds it,
 * its column of frames shows, and the other column stays hidden.
 */
export async function expectCanvasViewport(
  page: Page,
  viewport: "desktop" | "mobile",
): Promise<void> {
  await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
    viewport,
  );
  await expect(page.locator(canvasFrame(viewport))).toBeVisible();
  await expect(
    page.locator(canvasFrame(viewport === "desktop" ? "mobile" : "desktop")),
  ).toBeHidden();
}

/**
 * The selector of the routed page's or Markdown document's frame: the
 * canvas's reading frame from 900px wide, and the document pane's frame below.
 */
export const DOCUMENT_FRAME =
  "[data-mokly-stage] iframe, .mbk-stage-embed iframe";

/**
 * A window narrower than the 900px layout breakpoint, where the compact
 * layout shows one frame of a screen, the frame of the preview scheme, and
 * the catalogue and the right panel open as sheets from the dock.
 */
export const NARROW_WINDOW = { width: 860, height: 800 } as const;

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

/**
 * Open the compact layout's panel sheet with the dock's current tab, after
 * closing the catalogue's sheet.
 */
export async function openPanelSheet(scope: Page | Locator): Promise<void> {
  await closeOpenSheet(scope);
  await scope
    .getByRole("group", { name: "Canvas controls" })
    .getByRole("button", { name: "Inspect" })
    .click();
}

/**
 * Show a control of the right panel: in the compact layout the panel is a
 * sheet, which the dock opens while the control is hidden. Until the shell
 * shows the control or the way to it, the dock's Inspect or the open
 * catalogue sheet over the dock, it is still rendering, so this waits.
 */
export async function revealInPanel(
  scope: Page | Locator,
  control: Locator,
): Promise<void> {
  const tab = scope
    .getByRole("group", { name: "Canvas controls" })
    .getByRole("button", { name: "Inspect" });
  const catalogue = scope.getByRole("button", {
    name: "Close catalogue",
    exact: true,
  });
  await expect(
    control.or(tab).or(catalogue).filter({ visible: true }).first(),
  ).toBeVisible();
  if (await control.isVisible()) return;
  if ((await tab.isVisible()) || (await closeVisibleCatalogue(scope)))
    await openPanelSheet(scope);
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

/** Wait for the matching same-origin document and its blocking resources together. */
export async function expectFrameLoaded(
  frame: Locator,
  source: RegExp | string,
): Promise<void> {
  await expect
    .poll(() =>
      frame.evaluate((element: HTMLIFrameElement) => {
        const doc = element.contentDocument;
        return doc ? { url: doc.URL, readyState: doc.readyState } : null;
      }),
    )
    .toEqual({
      url: typeof source === "string" ? source : expect.stringMatching(source),
      readyState: "complete",
    });
}
