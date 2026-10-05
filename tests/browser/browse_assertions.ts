import { expect, type Page } from "@playwright/test";

export const welcomeRow =
  'a[data-nav-row][data-route="example/screens/welcome/index.html"]';

export const detailsRow =
  'a[data-nav-row][data-route="example/screens/details/index.html"]';

export const designHomeRow =
  'a[data-nav-row][data-route="design/browse/views/home/index.html"]';

export const tourRow = 'a[data-nav-row][data-route="example/tour/index.html"]';

export const appearance = ".mbk-topbar [data-mokly-appearance-control]";

export const appearanceSelect = "[data-mokly-appearance-select]";

export const face = (value: string) =>
  `[data-appearance-option="${value}"] .mbk-appearance-value`;

export const mobileFrame = ".mbk-frame-mobile iframe";

export const desktopFrame = ".mbk-frame-desktop iframe";

export const darkSurface = "rgb(18, 21, 20)";

export const formsChip =
  '[data-inspector-panel="details"] [data-mokly-tag="forms"]';

export const accentFill = "rgb(79, 120, 100)";

export async function markPage(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as { __moklyMarker?: boolean }).__moklyMarker = true;
  });
}

export function hasMarker(page: Page): Promise<boolean> {
  return page.evaluate(
    () => (window as { __moklyMarker?: boolean }).__moklyMarker === true,
  );
}

/**
 * Deeper navigation groups default closed away from their routes, so tests
 * that click a screen row from another page disclose its group first — the
 * same gesture a reader uses.
 */
export async function openScreensGroup(page: Page): Promise<void> {
  const group = page.locator(
    'details[data-nav-folder="folder:example/screens"]',
  );
  if ((await group.getAttribute("open")) === null) {
    await group.locator("summary").click();
  }
  await expect(page.locator(welcomeRow)).toBeVisible();
}

/** Visible workspace toggle and retained legacy state agree. */
export async function expectSchemeSelected(
  page: Page,
  value: "dark" | "light",
): Promise<void> {
  // The document mark is what every frame and caption follows. The control
  // may read Auto while resolving to the same scheme, so it is asserted where
  // an explicit choice was actually made.
  await expect(page.locator("body")).toHaveAttribute(
    "data-mokly-color-scheme",
    value,
  );
}

export function computedStyle(
  page: Page,
  selector: string,
  property:
    | "backgroundColor"
    | "boxShadow"
    | "display"
    | "position"
    | "textTransform"
    | "zIndex",
): Promise<string> {
  return page
    .locator(selector)
    .evaluate((element, name) => getComputedStyle(element)[name], property);
}

/**
 * A dark screen paints its edge on an `::after` overlay above the fragment, so
 * the hairline is read from the pseudo-element rather than the screen itself.
 */
export function overlayStyle(
  page: Page,
  selector: string,
  property: "boxShadow" | "position",
): Promise<string> {
  return page
    .locator(selector)
    .evaluate(
      (element, name) => getComputedStyle(element, "::after")[name],
      property,
    );
}

export async function workspaceRoute(page: Page): Promise<string | undefined> {
  const state = await page.locator("script[data-workspace-data]").textContent();
  if (!state) return;
  return (JSON.parse(state) as { entry?: { path?: string } }).entry?.path;
}
