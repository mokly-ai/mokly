import { expect, type Locator, type Page } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import { chooseFilter, modeButton, navRow } from "./comparison_ui.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

/** Inspector copy fixed by docs/protocol/mokly-css-evidence-shell.md. */
const BASE = "Compared with the branch point on fixture-base.";
const FILES_LEAD = "Changes to these files may affect this screen:";
const MATCHED_LEAD = "Changed styles that apply to this screen:";
const OUTSIDE_LEAD =
  "These changed styles also apply outside the changed components on this screen:";
const UNRESOLVED_LEAD =
  "This change can apply anywhere on the screen, so the screen stays in Changes:";
const EXCLUDED_LEAD =
  "This stylesheet changed, but none of the changed styles apply to this screen.";
const VARIANT_EXCLUDED_LEAD =
  "This stylesheet changed, but none of the changed styles apply to this variant.";
const EXAMINED_LEAD = "Examined and excluded:";
const SCREEN_TERMINAL = "No changes to this screen.";
const VARIANT_TERMINAL = "No changes to this saved view.";
const COMPONENT_FILES_LEAD =
  "Changes to these files may affect this component:";
const COMPONENT_LEAD = "Changed styles that apply to this component:";
const THEME = "static/mokly-generated/styles/theme.css";
const CHANGED_CSS = "static/mokly-generated/styles/changed.css";
const DUSK_CSS = "static/mokly-generated/styles/dusk.css";
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

/** A listed file: its own path text, then each nested lead and its styles. */
type EvidenceFile = [path: string, outcomes: [string, string[]][]];

/** The one changed-files list as it is grouped, or none when it is absent. */
function evidenceFiles(scope: Locator): Promise<EvidenceFile[]> {
  return scope.evaluate((panel) => {
    const list = panel.querySelector(".mbk-evidence-files");
    if (!list) return [];
    return [...list.children].map((item): EvidenceFile => {
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

/** Status literals of the evidence format never reach the reader. */
async function expectNoStatusWords(evidence: Locator): Promise<void> {
  for (const word of [/\bmatched\b/, /\bunresolved\b/, /\bentry\b/])
    await expect(evidence).not.toContainText(word);
  await expect(evidence).not.toContainText(/[0-9a-f]{64}/);
}

for (const [name, size] of INSPECTOR_VIEWPORTS) {
  test.describe(`${name} stylesheet Details`, () => {
    test.use({ viewport: size });

    test("a screen the changed styles reach names them in Details", async ({
      page,
    }) => {
      await page.goto(`/view/${comparisonPaths.darkOnly}/`);
      await chooseScheme(page, "dark");
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Changed",
      );
      const evidence = await openEvidence(page);
      await expect(
        evidence.getByText(FILES_LEAD, { exact: true }),
      ).toBeVisible();
      const files: EvidenceFile[] = [[DUSK_CSS, [[MATCHED_LEAD, [".dusk"]]]]];
      await expect.poll(() => evidenceFiles(evidence)).toEqual(files);
      await expect(evidence.locator("code.mbk-code")).toHaveText([".dusk"]);
      // The shared stylesheet changed too, but no changed style reaches it.
      await expect(
        evidence.getByText(EXCLUDED_LEAD, { exact: true }),
      ).toBeVisible();
      await expect(
        evidence.getByText(EXAMINED_LEAD, { exact: true }),
      ).toBeVisible();
      await expectNoStatusWords(evidence);
      await expect(page.locator("#mb-main h2").first()).toHaveText(
        "Dusk screen",
      );
      await expect(page.locator(".mbk-screen-head")).not.toContainText(".dusk");
      for (const preview of ["mobile", "desktop"] as const) {
        await chooseViewport(page, preview);
        await expect.poll(() => evidenceFiles(evidence)).toEqual(files);
      }
      // Details merge every compared view, so Light keeps the same facts.
      await chooseScheme(page, "light");
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Unmodified",
      );
      await expect.poll(() => evidenceFiles(evidence)).toEqual(files);
      await expect(
        evidence.getByText(EXCLUDED_LEAD, { exact: true }),
      ).toBeVisible();
    });

    test("a change that can reach anything says so without naming a status", async ({
      page,
    }) => {
      await page.goto(`/view/${comparisonPaths.changed}/`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Changed",
      );
      const evidence = await openEvidence(page);
      await expect(
        evidence.getByText(UNRESOLVED_LEAD, { exact: true }),
      ).toBeVisible();
      await expect
        .poll(async () => (await evidenceFiles(evidence))[0])
        .toEqual([CHANGED_CSS, [[UNRESOLVED_LEAD, [":root"]]]]);
      await expectNoStatusWords(evidence);
    });

    test("a screen names outside matches and keeps its unresolved paragraph", async ({
      page,
    }) => {
      await page.goto(`/view/${comparisonPaths.changed}/`);
      const evidence = await openEvidence(page);
      await expect(
        evidence.getByText(FILES_LEAD, { exact: true }),
      ).toBeVisible();
      await expect
        .poll(() => evidenceFiles(evidence))
        .toEqual([
          [CHANGED_CSS, [[UNRESOLVED_LEAD, [":root"]]]],
          [THEME, [[OUTSIDE_LEAD, [".accent"]]]],
        ]);
      await expect(
        evidence.getByRole("link", { name: "Card", exact: true }),
      ).toHaveAttribute("href", `/view/${comparisonPaths.component}/`);
      await expect(evidence).not.toContainText(SCREEN_TERMINAL);
      await expect(page.locator(".mbk-screen-head")).not.toContainText(
        ".accent",
      );
    });

    test("an excluded screen stays out of Changes and explains why", async ({
      page,
    }) => {
      await page.goto(`/view/${comparisonPaths.unchanged}/`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Unmodified",
      );
      await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
      const evidence = await openEvidence(page);
      // The paragraphs come from the entry detail; then the list stays empty.
      await expect(evidence.locator("p")).toHaveText([
        BASE,
        EXCLUDED_LEAD,
        EXAMINED_LEAD,
        SCREEN_TERMINAL,
      ]);
      await expect.poll(() => evidenceFiles(evidence)).toEqual([]);
      await expect(evidence.locator("ul > li")).toHaveText([THEME]);
      await expectNoStatusWords(evidence);
      if (name === "mobile")
        await page
          .getByRole("button", { name: "Open catalogue navigation" })
          .click();
      await chooseFilter(page, "changed");
      await expect(navRow(page, comparisonPaths.unchanged)).toBeHidden();
    });

    test("an affected-only screen keeps its full styles without a row of its own", async ({
      page,
    }) => {
      await page.goto(`/view/${comparisonPaths.consumer}/`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Unmodified",
      );
      const evidence = await openEvidence(page);
      await expect
        .poll(() => evidenceFiles(evidence))
        .toEqual([[THEME, [[MATCHED_LEAD, [".accent"]]]]]);
      await expect(
        evidence.getByRole("link", { name: "Card", exact: true }),
      ).toBeVisible();
      await expect(
        evidence.getByText(SCREEN_TERMINAL, { exact: true }),
      ).toBeVisible();
      await expect(
        page.locator('button[data-filter="changed"] .mbk-nav-filter-count'),
      ).toHaveText("23");
      if (name === "mobile")
        await page
          .getByRole("button", { name: "Open catalogue navigation" })
          .click();
      await chooseFilter(page, "changed");
      await expect(navRow(page, comparisonPaths.consumer)).toBeHidden();
      await expect(navRow(page, comparisonPaths.component)).toBeVisible();
    });

    test("an unchanged saved view closes with its own status line", async ({
      page,
    }) => {
      await page.goto(`/view/${comparisonPaths.quietParent}/`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Unmodified",
      );
      const evidence = await openEvidence(page);
      await expect(
        evidence.getByText(VARIANT_EXCLUDED_LEAD, { exact: true }),
      ).toBeVisible();
      await expect(evidence.locator("p").last()).toHaveText(VARIANT_TERMINAL);
      await expect(evidence).not.toContainText(SCREEN_TERMINAL);
    });
  });
}

test("the comparison heading leads with the style outcome", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const heading = (viewport: string) =>
    page.locator(`[data-diff-viewport="${viewport}"] h3`);
  await page.goto(`/view/${comparisonPaths.darkOnly}/`);
  await chooseScheme(page, "dark");
  await chooseViewport(page, "desktop");
  await modeButton(page, "Overlay").click();
  await expect(heading("desktop")).toHaveText(
    "Desktop · Styles this screen uses changed",
  );
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await modeButton(page, "Overlay").click();
  await expect(heading("desktop")).toHaveText("Desktop · Screen changed");
  await page.goto(`/view/${comparisonPaths.component}/`);
  const evidence = await openEvidence(page);
  await expect
    .poll(() => evidenceFiles(evidence))
    .toEqual([[THEME, [[COMPONENT_LEAD, [".accent"]]]]]);
  await expect(
    evidence.getByText(COMPONENT_FILES_LEAD, { exact: true }),
  ).toBeVisible();
  await modeButton(page, "Overlay").click();
  await expect(heading("desktop")).toHaveText(
    "Desktop · Styles this variant uses changed",
  );
});
