/**
 * A component whose own saved views stay the same, while a screen's use of it
 * renders differently, carries the `implementation` reason. Its Details name
 * that reason before any comparison is requested, at both inspector sizes,
 * and its affected screen, which its Affected screens link opens in Side by
 * side, links back to it.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import {
  addImplementationSources,
  implementationPaths as paths,
} from "../helpers/implementation_sources.js";

import { additionsCopyTest } from "./additions_copy_test.js";
import {
  BASE,
  EXAMINED_LEAD,
  INSPECTOR_VIEWPORTS,
  VARIANT_EXCLUDED_LEAD,
  openEvidence,
} from "./comparison_evidence_page.js";
import {
  awaitRoutedDetail,
  expectNoCompareModes,
  modeButton,
  outcomeLines,
} from "./comparison_ui.js";
import { openInspectFold, openPanelTab } from "./workspace_actions.js";

const test = additionsCopyTest(
  "browser-implementation",
  addImplementationSources,
);

/** The reason sentence fixed by the workspace design contract. */
const IMPLEMENTATION = "Rendered content changed where this component is used.";
/** The shared stylesheet changed too, but none of its changed styles apply. */
const EXCLUDED = [VARIANT_EXCLUDED_LEAD, EXAMINED_LEAD];

/** The comparison snapshot documents that the page requests from its start. */
function snapshotDocuments(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (/\/diffs\/generations\/[^/]+\/snapshots\/.+\.html$/u.test(path))
      seen.push(path);
  });
  return seen;
}

/** The outcome that each view of the consuming screen shows. */
const COMPONENTS_CHANGED = "Components this screen uses changed";

/**
 * The consuming screen's outcome lines in Side by side, at each inspector
 * size: on the wide canvas every shown frame compares, and the compact
 * layout compares the Light frame of the viewport that the link names.
 */
const CONSUMER_OUTCOMES = {
  desktop: [
    `Desktop · Light · ${COMPONENTS_CHANGED}`,
    `Mobile · Light · ${COMPONENTS_CHANGED}`,
    `Desktop · Dark · ${COMPONENTS_CHANGED}`,
    `Mobile · Dark · ${COMPONENTS_CHANGED}`,
  ],
  mobile: [
    new RegExp(`^(?:Desktop|Mobile) · Light · ${COMPONENTS_CHANGED}$`, "u"),
  ],
} as const;

/** The sentences of the comparison details, in order. */
function sentences(evidence: Locator) {
  return evidence.evaluate((panel) =>
    [...panel.querySelectorAll(":scope > p")].map(
      (sentence) => sentence.textContent?.trim() ?? "",
    ),
  );
}

for (const [name, size] of INSPECTOR_VIEWPORTS)
  test(`${name}: a component changed only where it is used says so before any comparison`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const documents = snapshotDocuments(page);
    await page.goto(`/view/${paths.component}/`);
    await expect(page.locator("[data-workspace-status]")).toHaveText("Changed");
    // Its own saved views are unchanged, so it offers no comparison.
    await awaitRoutedDetail(page, paths.component);
    await expectNoCompareModes(page);
    const evidence = await openEvidence(page);
    await expect
      .poll(() => sentences(evidence))
      .toEqual([BASE, IMPLEMENTATION, ...EXCLUDED]);
    await expect(evidence).not.toContainText("Rendered content changed.");
    expect(documents).toEqual([]);

    const usage = await openInspectFold(page, "usage");
    const affected = usage.locator("[data-usage-section='affected'] a");
    // The link opens the instance's own view of the consuming screen in its
    // comparison, which the screen offers while it stays Unmodified.
    await expect(affected.first()).toHaveAttribute(
      "href",
      new RegExp(`^/view/${paths.consumer}/\\?viewport=.*&comparison=side$`),
    );
    await affected.first().click();
    await expect(page).toHaveURL(new RegExp(`/view/${paths.consumer}/`));
    await expect(page.locator("[data-workspace-status]")).toHaveText(
      "Unmodified",
    );
    // The band and its outcome lines stand in the Changes tab.
    await openPanelTab(page, "Changes");
    await expect(modeButton(page, "Side by side")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(outcomeLines(page)).toHaveText([...CONSUMER_OUTCOMES[name]]);
    await openEvidence(page);
    await expect(
      evidence.getByRole("link", { name: "Chip", exact: true }),
    ).toHaveAttribute("href", `/view/${paths.component}/`);
    await expect(evidence).not.toContainText(IMPLEMENTATION);
    // Only the screen's comparison loads; Chip's Details needed none.
    expect(documents.length).toBeGreaterThan(0);
    for (const document of documents)
      expect(document).toMatch(
        new RegExp(
          `/snapshots/(?:before|after)/mokly-generated/${paths.consumer}/`,
        ),
      );
  });
