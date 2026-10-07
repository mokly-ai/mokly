import { expect, type Locator, type Page } from "@playwright/test";

/** The one changed stylesheet every evidence fixture screen links. */
export const STYLESHEET = "mockups/shared.css";
/** Inspector copy fixed by docs/protocol/mokly-css-evidence-shell.md. */
export const FILES_LEAD = "Changes to these files may affect this screen:";
export const MATCHED_LEAD = "Changed styles that apply to this screen:";
export const UNRESOLVED_LEAD =
  "This change can apply anywhere on the screen, so the screen stays in Changes:";
export const UNNAMED_LEAD =
  "This change can apply anywhere on the screen, so the screen stays in Changes.";
export const EXCLUDED_LEAD =
  "This stylesheet changed, but none of the changed styles apply to this screen.";
export const EXAMINED_LEAD = "Examined and excluded:";
/** Terminal status lines, which follow the kind of entry on display. */
export const SCREEN_TERMINAL = "No changes to this screen.";
export const VARIANT_TERMINAL = "No changes to this saved view.";
/** Comparison stage headings derived from the view's own evidence. */
export const STYLE_HEADING = "Styles this screen uses changed";
export const CHANGED_HEADING = "Screen changed";
export const UNCHANGED_HEADING = "No changes to this screen";
/** The mobile inspector sheet and the desktop inspector dock. */
export const INSPECTOR_VIEWPORTS = [
  ["desktop", { width: 1440, height: 1000 }],
  ["mobile", { width: 390, height: 844 }],
] as const;

/**
 * Open the Details tab and return the evidence panel it reveals.
 *
 * A mounted component workspace already starts on Details, so clicking the tab
 * unconditionally would close it. Select it only while it is not selected, and
 * retry until the mounted shell answers the click.
 */
export async function openEvidence(page: Page): Promise<Locator> {
  const tab = page.getByRole("tab", { name: "Details", exact: true });
  const evidence = page.locator("[data-workspace-evidence]");
  await expect(async () => {
    if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
    await expect(evidence).toBeVisible({ timeout: 15_000 });
  }).toPass({ timeout: 15_000 });
  await expect(evidence).toContainText("Comparison details");
  return evidence;
}

/** Reveal the catalogue tree, which the mobile shell keeps behind a control. */
export async function openCatalogue(
  page: Page,
  viewport: string,
): Promise<void> {
  if (viewport === "desktop") return;
  await page.getByRole("button", { name: "Open catalogue navigation" }).click();
}

/** The mockup card's spacing, read back from the served evidence container. */
export function evidenceSpacing(
  evidence: Locator,
): Promise<{ paragraph: string; list: string; afterList: string }> {
  return evidence.evaluate((panel: Element) => {
    const margin = (element: Element | null) =>
      element ? getComputedStyle(element).marginTop : "";
    return {
      paragraph: margin(panel.querySelector("p")),
      list: margin(panel.querySelector("ul")),
      afterList: margin(panel.querySelector("ul + p")),
    };
  });
}

/** Load the side-by-side comparison and return its per-viewport headings. */
export async function openComparison(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  const headings = page.locator(".mbk-diff-view h3");
  await expect(headings.first()).toBeVisible();
  return headings;
}
