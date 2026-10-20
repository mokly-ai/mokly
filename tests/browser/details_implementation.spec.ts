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
import { modeButton } from "./comparison_ui.js";

const test = additionsCopyTest(
  "browser-implementation",
  addImplementationSources,
);

/** The reason sentence fixed by the workspace design contract. */
const IMPLEMENTATION = "Rendered content changed where this component is used.";
/** The shared stylesheet changed too, but none of its changed styles apply. */
const EXCLUDED = [VARIANT_EXCLUDED_LEAD, EXAMINED_LEAD];

/** Count the selected comparison's review requests from the page's start. */
function reviewRequests(page: Page): { count: number } {
  const seen = { count: 0 };
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/review.json")) seen.count++;
  });
  return seen;
}

/** Select one inspector tab by its accessible name. */
async function inspectorTab(page: Page, name: string): Promise<void> {
  const tab = page.getByRole("tab", { name, exact: true });
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

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
    const requests = reviewRequests(page);
    await page.goto(`/view/${paths.component}/`);
    await expect(page.locator("[data-workspace-status]")).toHaveText("Changed");
    // Its own saved views are unchanged, so it offers no comparison.
    await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
    const evidence = await openEvidence(page);
    await expect
      .poll(() => sentences(evidence))
      .toEqual([BASE, IMPLEMENTATION, ...EXCLUDED]);
    await expect(evidence).not.toContainText("Rendered content changed.");
    expect(requests.count).toBe(0);

    await inspectorTab(page, "Usage");
    const affected = page.locator("[data-usage-section='affected'] a");
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
    await expect(modeButton(page, "Side by side")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("[data-diff-viewport] > h3")).toHaveText([
      /· Components this screen uses changed$/u,
    ]);
    await openEvidence(page);
    await expect(
      evidence.getByRole("link", { name: "Chip", exact: true }),
    ).toHaveAttribute("href", `/view/${paths.component}/`);
    await expect(evidence).not.toContainText(IMPLEMENTATION);
    // Only the screen's comparison loads; Chip's Details needed none.
    expect(requests.count).toBe(1);
  });
