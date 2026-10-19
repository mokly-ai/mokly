/**
 * Screen stylesheet evidence on the copied comparison output, under the CSS
 * evidence shell and attribution contracts, at both inspector sizes. A
 * changed selector-less at-rule is named by its at-rule and prelude, and its
 * file keeps the screen in Changes. A changed rule that matches only the
 * mobile view names its style, and the desktop view's comparison reads as
 * unchanged.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import { modeButton } from "./comparison_ui.js";

/** Inspector copy fixed by docs/protocol/mokly-css-evidence-shell.md. */
const BASE = "Compared with the branch point on fixture-base.";
/** The sentence of an unresolved change without selectors. */
const UNNAMED_LEAD =
  "This change can apply anywhere on the screen, so the screen stays in Changes.";
const UNRESOLVED_LEAD =
  "This change can apply anywhere on the screen, so the screen stays in Changes:";
const MATCHED_LEAD = "Changed styles that apply to this screen:";
const EXCLUDED_LEAD =
  "This stylesheet changed, but none of the changed styles apply to this screen.";
const EXAMINED_LEAD = "Examined and excluded:";
const STYLE_HEADING = "Styles this screen uses changed";
const UNCHANGED_HEADING = "No changes to this screen";
const FADE = "static/mokly-generated/styles/fade.css";
const INSPECTOR_VIEWPORTS = [
  ["desktop", { width: 1440, height: 1000 }],
  ["mobile", { width: 390, height: 844 }],
] as const;

/** Open the Details tab and return the comparison details it reveals. */
async function openEvidence(page: Page): Promise<Locator> {
  const tab = page.getByRole("tab", { name: "Details", exact: true });
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  const evidence = page.locator("[data-workspace-evidence]");
  await expect(evidence).toBeVisible();
  await expect(evidence.locator("p").first()).toHaveText(BASE);
  return evidence;
}

/** The changed-files list: each file with its nested leads and styles. */
function evidenceFiles(scope: Locator) {
  return scope.evaluate((panel) =>
    [...(panel.querySelector(".mbk-evidence-files")?.children ?? [])].map(
      (item) => {
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
      },
    ),
  );
}

/** The top margins of the first paragraph, list, and nested sentence. */
function evidenceSpacing(evidence: Locator) {
  return evidence.evaluate((panel) =>
    Object.fromEntries(
      Object.entries({
        paragraph: "p",
        list: "ul",
        sentence: ".mbk-evidence-files > li > p",
        styles: ".mbk-evidence-files > li > ul",
      }).flatMap(([part, selector]) => {
        const element = panel.querySelector(selector);
        return element ? [[part, getComputedStyle(element).marginTop]] : [];
      }),
    ),
  );
}

for (const [name, size] of INSPECTOR_VIEWPORTS)
  test.describe(`${name} screen evidence`, () => {
    test.use({ viewport: size });

    test("a selector-less at-rule change names its at-rule and keeps the screen in Changes", async ({
      page,
    }) => {
      await page.goto(`/view/${comparisonPaths.atRuleChange}/`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Changed",
      );
      const evidence = await openEvidence(page);
      await expect(
        evidence.getByText(UNRESOLVED_LEAD, { exact: true }),
      ).toBeVisible();
      expect(await evidenceFiles(evidence)).toEqual([
        [FADE, [[UNRESOLVED_LEAD, ["@keyframes fixture-fade"]]]],
      ]);
      await expect(evidence.locator("code.mbk-code")).toHaveText([
        "@keyframes fixture-fade",
      ]);
      for (const lead of [UNNAMED_LEAD, MATCHED_LEAD, EXCLUDED_LEAD])
        await expect(evidence.getByText(lead, { exact: true })).toHaveCount(0);
      expect(await evidenceSpacing(evidence)).toMatchObject({
        paragraph: "8px",
        list: "8px",
        sentence: "8px",
      });
    });

    test("a released viewport reads as unchanged beside a retained one", async ({
      page,
    }) => {
      await page.goto(`/view/${comparisonPaths.mobileOnlyChange}/`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Changed",
      );
      const evidence = await openEvidence(page);
      await expect(
        evidence.getByText(MATCHED_LEAD, { exact: true }),
      ).toBeVisible();
      await expect(evidence.locator("code.mbk-code")).toHaveText([".auth"]);
      for (const lead of [EXCLUDED_LEAD, EXAMINED_LEAD])
        await expect(evidence).not.toContainText(lead);
      await modeButton(page, "Side by side").click();
      await expect(page.locator(".mbk-diff-view h3")).toHaveText([
        `Mobile · ${STYLE_HEADING}`,
        `Desktop · ${UNCHANGED_HEADING}`,
      ]);
    });
  });
