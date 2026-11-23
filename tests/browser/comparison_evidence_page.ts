/**
 * Inspector copy and readers for the stylesheet Details specs on comparison
 * copies. The copy is fixed by docs/protocol/mokly-css-evidence-presentation.md
 * and docs/protocol/mokly-css-evidence-shell.md.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { comparedRail } from "./changes_tab_ui.js";
import { openPanelTab } from "./workspace_actions.js";

/** The base that the copies name. */
const BASE_NAME = "fixture-base";
/** The branch-point sentence starts so. */
const BRANCH_POINT = "Compared with the branch point";
/** The details' branch-point sentence, which Inspect shows. */
export const BASE = `${BRANCH_POINT} on ${BASE_NAME}.`;
/**
 * The Compared rail's version before, which names the branch point in the
 * Changes tab in place of the details' sentence.
 */
export const RAIL_BASE = `Before Branch point on ${BASE_NAME}`;
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
/** The sentence that ends a screen's Details when only changed components affect it. */
export const SHARED_IMPACT =
  "Changed components that this screen uses affect its preview.";
export const COMPONENT_FILES_LEAD =
  "Changes to these files may affect this component:";
export const COMPONENT_LEAD = "Changed styles that apply to this component:";
export const VARIANT_LEAD = "Changed styles that apply to this variant:";
export const VARIANT_UNRESOLVED_LEAD =
  "This change can apply anywhere on the variant, so the variant stays in Changes:";
export const VARIANT_TERMINAL = "No changes to this variant.";
/** The same sentence for a component and its variants. */
export const VARIANT_SHARED_IMPACT =
  "Changed components that this variant uses affect its preview.";
/** Any kind's shared-component sentence, for checks that none shows. */
export const SHARED =
  /Changed components that this \w+ uses affect its preview\./u;
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
 * The tab of the right panel that holds an entry's comparison details: its
 * Changes tab where the entry has one, and Inspect, after its head,
 * otherwise.
 */
export type DetailsTab = "Changes" | "Inspect";

/**
 * Expect the Changes tab to name the branch point in its Compared rail, in
 * place of the branch-point sentence that `evidence`, its comparison
 * details, leave out.
 */
export async function expectRailBase(
  page: Page,
  evidence: Locator,
): Promise<void> {
  await expect(evidence).not.toContainText(BRANCH_POINT);
  await expect(
    comparedRail(page)
      .getByRole("listitem")
      .filter({ hasText: "Branch point" }),
  ).toHaveText(RAIL_BASE);
}

/**
 * Show the comparison details that the data attribute `mark` names in `tab`,
 * opening the compact layout's panel sheet, and return them. They hold one
 * Comparison details heading. In Inspect they start with the branch-point
 * sentence `base`, and an index without a base has none: pass `null`. In
 * Changes the Compared rail names the branch point in place of the sentence.
 */
async function showDetails(
  page: Page,
  mark: string,
  tab: DetailsTab,
  base: string | null,
): Promise<Locator> {
  await openPanelTab(page, tab);
  const evidence = page.locator(`[${mark}]`);
  await expect(
    page.getByRole("tabpanel", { name: tab, exact: true }).locator(`[${mark}]`),
  ).toBeVisible();
  await expect(
    evidence.getByRole("heading", { name: "Comparison details", exact: true }),
  ).toHaveCount(1);
  if (tab === "Changes") await expectRailBase(page, evidence);
  else if (base === null)
    await expect(evidence).not.toContainText(BRANCH_POINT);
  else await expect(evidence.locator("p").first()).toHaveText(base);
  return evidence;
}

/**
 * Show the comparison details of a screen or a component without a Changes
 * tab, which Inspect holds after its head, and return them. They start with
 * the branch-point sentence `base`; pass `null` for an index without a base.
 */
export function openEvidence(
  page: Page,
  base: string | null = BASE,
): Promise<Locator> {
  return showDetails(page, "data-workspace-evidence", "Inspect", base);
}

/**
 * Show the comparison details of a screen or a component in its Changes tab
 * and return them; the tab's Compared rail names the branch point. An entry
 * that the Changes filter does not list gains its Changes tab only once its
 * detail makes its comparison eligible, so wait for `awaitRoutedDetail`
 * before showing such an entry's details.
 */
export function openChangesEvidence(page: Page): Promise<Locator> {
  return showDetails(page, "data-workspace-evidence", "Changes", BASE);
}

/**
 * Show a whole page's comparison details in `tab` and return them: Changes
 * for a page that the Changes filter lists, and Inspect for any other page.
 */
export function openPageEvidence(
  page: Page,
  tab: DetailsTab,
): Promise<Locator> {
  return showDetails(page, "data-page-evidence", tab, BASE);
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
