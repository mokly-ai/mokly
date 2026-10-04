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
export const OUTSIDE_LEAD =
  "These changed styles also apply outside the changed components on this screen:";
/** The component and saved-view sentences of the same contract. */
export const COMPONENT_FILES_LEAD =
  "Changes to these files may affect this component:";
export const COMPONENT_LEAD = "Changed styles that apply to this component:";
export const SAVED_VIEW_LEAD = "Changed styles that apply to this saved view:";
export const SAVED_VIEW_UNRESOLVED_LEAD =
  "This change can apply anywhere on the saved view, so the saved view stays in Changes:";
/** The whole-document page sentences of the same contract. */
export const PAGE_FILES_LEAD = "Changes to these files may affect this page:";
export const PAGE_MATCHED_LEAD = "Changed styles that apply to this page:";
export const PAGE_OUTSIDE_LEAD =
  "These changed styles also apply outside the changed components on this page:";
export const PAGE_UNRESOLVED_LEAD =
  "This change can apply anywhere on the page, so the page stays in Changes:";
export const PAGE_EXCLUDED_LEAD =
  "This stylesheet changed, but none of the changed styles apply to this page.";
/** Terminal status lines, which follow the kind of entry on display. */
export const SCREEN_TERMINAL = "No changes to this screen.";
export const VARIANT_TERMINAL = "No changes to this saved view.";
export const PAGE_TERMINAL = "No changes to this page.";
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
    await expect(evidence).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expect(evidence).toContainText("Comparison details");
  return evidence;
}

/**
 * Open a whole-document page's Details and return its comparison details.
 * The panel keeps its last choice, so open it only while it is closed.
 */
export async function openPageEvidence(page: Page): Promise<Locator> {
  const details = page.locator("[data-mokly-details]");
  const evidence = page.locator("[data-page-evidence]");
  await expect(async () => {
    if (!(await details.evaluate((element) => element.hasAttribute("open"))))
      await details.locator("summary").click();
    await expect(evidence).toBeVisible({ timeout: 1000 });
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

/**
 * The mockup card's spacing, read back from the served evidence container:
 * its first paragraph and list, the first file's nested sentence and style
 * list, and the first paragraph after a list. Absent elements are omitted.
 */
export function evidenceSpacing(
  evidence: Locator,
): Promise<Partial<Record<SpacingPart, string>>> {
  return evidence.evaluate((panel: Element) => {
    const parts = {
      paragraph: "p",
      list: "ul",
      sentence: ".mbk-evidence-files > li > p",
      styles: ".mbk-evidence-files > li > ul",
      afterList: "ul + p",
    };
    return Object.fromEntries(
      Object.entries(parts).flatMap(([part, selector]) => {
        const element = panel.querySelector(selector);
        return element ? [[part, getComputedStyle(element).marginTop]] : [];
      }),
    );
  });
}

/** One spacing measurement that the evidence container must render. */
export type SpacingPart =
  "paragraph" | "list" | "sentence" | "styles" | "afterList";

/** A listed file: its own path text, then each nested lead and its styles. */
export type EvidenceFile = [path: string, outcomes: [string, string[]][]];

/**
 * Read the one changed-files list as it is grouped: each file once, with the
 * sentences and selectors that sit under it and nowhere else.
 */
export async function evidenceFiles(scope: Locator): Promise<EvidenceFile[]> {
  const list = scope.locator(".mbk-evidence-files");
  await expect(list).toHaveCount(1);
  return list.evaluate((element: Element) =>
    [...element.children].map((item): EvidenceFile => {
      const outcomes: [string, string[]][] = [];
      for (const child of item.children)
        if (child.tagName === "P")
          outcomes.push([child.textContent?.trim() ?? "", []]);
        else
          outcomes
            .at(-1)?.[1]
            .push(
              ...[...child.querySelectorAll("code")].map(
                (code) => code.textContent ?? "",
              ),
            );
      const path = [...item.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join("")
        .trim();
      return [path, outcomes];
    }),
  );
}

/** Load the side-by-side comparison and return its per-viewport headings. */
export async function openComparison(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  const headings = page.locator(".mbk-diff-view h3");
  await expect(headings.first()).toBeVisible();
  return headings;
}
