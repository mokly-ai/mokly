/**
 * Inspector copy and readers for the stylesheet Details specs on comparison
 * copies. The copy is fixed by docs/protocol/mokly-css-evidence-shell.md.
 */

import { expect, type Locator, type Page } from "@playwright/test";

/** The branch-point sentence starts so, and the copies name `fixture-base`. */
export const BRANCH_POINT = "Compared with the branch point";
export const BASE = `${BRANCH_POINT} on fixture-base.`;
export const FILES_LEAD = "Changes to these files may affect this screen:";
export const MATCHED_LEAD = "Changed styles that apply to this screen:";
export const OUTSIDE_LEAD =
  "These changed styles also apply outside the changed components on this screen:";
export const UNRESOLVED_LEAD =
  "This change can apply anywhere on the screen, so the screen stays in Changes:";
/** The sentence of an unresolved change without selectors. */
export const UNNAMED_LEAD =
  "This change can apply anywhere on the screen, so the screen stays in Changes.";
export const EXCLUDED_LEAD =
  "This stylesheet changed, but none of the changed styles apply to this screen.";
export const VARIANT_EXCLUDED_LEAD =
  "This stylesheet changed, but none of the changed styles apply to this variant.";
export const EXAMINED_LEAD = "Examined and excluded:";
export const SCREEN_TERMINAL = "No changes to this screen.";
export const COMPONENT_FILES_LEAD =
  "Changes to these files may affect this component:";
export const COMPONENT_LEAD = "Changed styles that apply to this component:";
export const SAVED_VIEW_LEAD = "Changed styles that apply to this saved view:";
export const SAVED_VIEW_UNRESOLVED_LEAD =
  "This change can apply anywhere on the saved view, so the saved view stays in Changes:";
export const VARIANT_TERMINAL = "No changes to this saved view.";
export const SHARED = "Shared component changes affect this preview.";
export const PAGE_FILES_LEAD = "Changes to these files may affect this page:";
export const PAGE_MATCHED_LEAD = "Changed styles that apply to this page:";
export const PAGE_OUTSIDE_LEAD =
  "These changed styles also apply outside the changed components on this page:";
export const PAGE_UNRESOLVED_LEAD =
  "This change can apply anywhere on the page, so the page stays in Changes:";
export const PAGE_EXCLUDED_LEAD =
  "This stylesheet changed, but none of the changed styles apply to this page.";
export const PAGE_TERMINAL = "No changes to this page.";

/** The desktop inspector dock and the mobile inspector sheet. */
export const INSPECTOR_VIEWPORTS = [
  ["desktop", { width: 1440, height: 1000 }],
  ["mobile", { width: 390, height: 844 }],
] as const;

/**
 * The one Comparison details heading, then the branch-point sentence `base`.
 * An index without a base has no branch-point sentence: pass `null`.
 */
async function expectComparisonDetails(
  evidence: Locator,
  base: string | null,
): Promise<void> {
  await expect(evidence).toBeVisible();
  await expect(
    evidence.getByRole("heading", { name: "Comparison details", exact: true }),
  ).toHaveCount(1);
  if (base === null) await expect(evidence).not.toContainText(BRANCH_POINT);
  else await expect(evidence.locator("p").first()).toHaveText(base);
}

/**
 * Select the Details tab and return the comparison details it shows, which
 * start with the branch-point sentence `base`.
 */
export async function openEvidence(
  page: Page,
  base: string | null = BASE,
): Promise<Locator> {
  const tab = page.getByRole("tab", { name: "Details", exact: true });
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  const evidence = page.locator("[data-workspace-evidence]");
  await expectComparisonDetails(evidence, base);
  return evidence;
}

/**
 * Open a whole page's Details and return its comparison details. The panel
 * keeps its last choice, so open it only while it is closed.
 */
export async function openPageEvidence(page: Page): Promise<Locator> {
  const details = page.locator("[data-mokly-details]");
  await expect(details).toBeVisible();
  if (!(await details.evaluate((element) => element.hasAttribute("open"))))
    await details.locator("summary").click();
  const evidence = page.locator("[data-page-evidence]");
  await expectComparisonDetails(evidence, BASE);
  return evidence;
}

/**
 * Excluded-only Details: `sentences` in order, one examined list that names
 * `files`, and no changed-files list.
 */
export async function expectExcludedOnly(
  evidence: Locator,
  sentences: readonly string[],
  files: readonly string[],
): Promise<void> {
  await expect(evidence.locator(":scope > p")).toHaveText([...sentences]);
  await expect(evidence.locator(":scope > ul")).toHaveCount(1);
  await expect(evidence.locator(":scope > ul > li")).toHaveText([...files]);
  await expect(evidence.locator(".mbk-evidence-files")).toHaveCount(0);
}

/** A listed file: its own path text, then each nested lead and its styles. */
export type EvidenceFile = [path: string, outcomes: [string, string[]][]];

/**
 * The one changed-files list as it is grouped. Any other number of lists
 * reads as that count alone, so a poll for the expected files keeps waiting.
 */
export function evidenceFiles(scope: Locator): Promise<EvidenceFile[]> {
  return scope.evaluate((panel) => {
    const lists = panel.querySelectorAll(".mbk-evidence-files");
    if (lists.length !== 1) return [[`${lists.length} file lists`, []]];
    return [...lists[0]!.children].map((item): EvidenceFile => {
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
      return [item.firstChild?.textContent?.trim() ?? "", outcomes];
    });
  });
}

/**
 * The card's spacing: its first paragraph and list, the first file's nested
 * sentence and style list, and the first paragraph after a list. An absent
 * part reads as an empty string.
 */
export function evidenceSpacing(scope: Locator) {
  return scope.evaluate((panel) => {
    const margin = (selector: string) => {
      const element = panel.querySelector(selector);
      return element ? getComputedStyle(element).marginTop : "";
    };
    return {
      paragraph: margin("p"),
      list: margin("ul"),
      sentence: margin(".mbk-evidence-files > li > p"),
      styles: margin(".mbk-evidence-files > li > ul"),
      afterList: margin("ul + p"),
    };
  });
}
