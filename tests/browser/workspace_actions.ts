import { expect, type Page, type Locator } from "@playwright/test";

import { revealInPanel } from "./panel_actions.js";

export {
  closeOpenSheet,
  openCatalogueSheet,
  openInspectFold,
  openPanelSheet,
  openPanelTab,
  revealInPanel,
} from "./panel_actions.js";

/** A toggle of the Frames filter in Inspect. */
export type FramesToggleName = "mobile" | "desktop" | "light" | "dark";

/**
 * Choose an appearance. A standalone document has one Appearance control that
 * sets the interface and the previews together. An embedded root has no
 * Appearance: a document's Dark preview control stands in Inspect's head, and
 * a screen, a variant set or a use case shows the scheme's frames alone
 * through its Frames filter.
 */
export async function chooseScheme(
  page: Page,
  value: "light" | "dark",
): Promise<void> {
  await expect(
    page
      .locator(
        "[data-mokly-appearance-select], [data-workspace-scheme], [data-frames-toggle]",
      )
      .first(),
  ).toBeAttached();
  const appearance = page.locator("[data-mokly-appearance-select]");
  if (await appearance.count()) {
    await appearance.selectOption(value);
    return;
  }
  const toggle = page.locator("[data-workspace-scheme]");
  if (await toggle.count()) {
    await revealInPanel(page, toggle);
    if (
      (await toggle.getAttribute("aria-pressed")) !== String(value === "dark")
    )
      await toggle.click();
    return;
  }
  await setFrames(page, {
    dark: value === "dark",
    light: value === "light",
  });
}

/**
 * Show the frames of one viewport, or of both, through the Frames filter. A
 * variant set shows each row's desktop view and has no viewport toggles, so
 * its canvas stays as it is.
 */
export async function chooseViewport(
  page: Page,
  value: "mobile" | "desktop" | "both",
): Promise<void> {
  const toggles = page.locator(
    '[data-frames-toggle="mobile"], [data-frames-toggle="desktop"]',
  );
  await expect(page.locator("[data-frames-toggle]").first()).toBeAttached();
  if (!(await toggles.count())) return;
  await setFrames(page, {
    desktop: value !== "mobile",
    mobile: value !== "desktop",
  });
}

/**
 * Turn toggles of the Frames filter on or off: the ones to turn on first,
 * because an axis keeps one of its toggles on. A use case's filter is radio
 * pairs, so only the toggles to turn on act there.
 */
export async function setFrames(
  scope: Page | Locator,
  choice: Partial<Record<FramesToggleName, boolean>>,
): Promise<void> {
  const toggle = (name: string) =>
    scope.locator(`[data-frames-toggle="${name}"]`);
  await revealInPanel(scope, toggle(Object.keys(choice)[0] ?? "light"));
  const entries = Object.entries(choice);
  for (const [name, on] of entries)
    if (on && !(await toggle(name).isChecked())) await toggle(name).check();
  for (const [name, on] of entries)
    if (
      !on &&
      (await toggle(name).getAttribute("type")) === "checkbox" &&
      (await toggle(name).isChecked())
    )
      await toggle(name).uncheck();
}

/**
 * Choose a row of Inspect's Variants: a screen's variant is a link that opens
 * it, and a variant set's row selects that row's Light frame.
 */
export async function chooseVariant(page: Page, title: string): Promise<void> {
  const variants = page.locator('[data-inspect-section="variants"]');
  const row = variants
    .getByRole("link", { name: title, exact: true })
    .or(variants.getByRole("button", { name: title, exact: true }));
  await revealInPanel(page, row);
  await row.click();
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
 * Expect the canvas to keep a chosen viewport: the Frames filter shows it
 * alone, its column of frames shows, and the other column stays hidden.
 */
export async function expectCanvasViewport(
  page: Page,
  viewport: "desktop" | "mobile",
): Promise<void> {
  const other = viewport === "desktop" ? "mobile" : "desktop";
  await expect(
    page.locator(`[data-frames-toggle="${viewport}"]`),
  ).toBeChecked();
  await expect(
    page.locator(`[data-frames-toggle="${other}"]`),
  ).not.toBeChecked();
  await expect(page.locator(canvasFrame(viewport))).toBeVisible();
  await expect(page.locator(canvasFrame(other))).toBeHidden();
}

/**
 * Zoom the wide canvas in until it draws its frames at 60% of their size or
 * more, where the tags on its frames show, such as a highlight's labels and
 * the selection's tags. The compact layout has no zoom pill, and its one
 * frame keeps its own zoom.
 */
export async function zoomToTags(scope: Page | Locator): Promise<void> {
  const pill = scope.getByRole("group", { name: "Zoom" });
  await expect(
    pill.or(scope.locator("[data-canvas-dock]")).first(),
  ).toBeVisible();
  if (!(await pill.isVisible())) return;
  const zoom = async () =>
    Number.parseInt(
      (await pill.locator(".mbk-zoom-value").textContent()) ?? "0",
      10,
    );
  while ((await zoom()) < 60)
    await pill.getByRole("button", { name: "Zoom in" }).click();
}

/**
 * The selector of the routed page's or Markdown document's frame: the
 * canvas's reading frame, in both layouts.
 */
export const DOCUMENT_FRAME = "[data-mokly-stage] iframe";

/**
 * A window narrower than the 900px layout breakpoint, where the compact
 * layout shows one frame of a screen, the frame of the preview scheme, and
 * the catalogue and the right panel open as sheets from the dock.
 */
export const NARROW_WINDOW = { width: 860, height: 800 } as const;

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
