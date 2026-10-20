/**
 * Details read a screen's direct reasons and stylesheet facts from its entry
 * detail before any comparison loads (decision D1 of the shell delivery
 * contract). Current, a loaded comparison, and the Changes filter then show
 * the same facts once. Both cases run on the copied comparison output.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { parseReviewResult } from "../../packages/viewer/src/review/result_validation.js";

import { comparisonPaths, test } from "./comparison_test.js";
import {
  changesPaths,
  chooseFilter,
  comparisonIndex,
  modeButton,
  showMode,
} from "./comparison_ui.js";

/** Inspector copy fixed by the CSS evidence and shell delivery contracts. */
const BASE = "Compared with the branch point on fixture-base.";
const MATERIAL = "Rendered content changed.";
const OUTSIDE_LEAD =
  "These changed styles also apply outside the changed components on this screen:";
const UNRESOLVED_LEAD =
  "This change can apply anywhere on the screen, so the screen stays in Changes:";
const MATCHED_LEAD = "Changed styles that apply to this screen:";
const THEME = "static/mokly-generated/styles/theme.css";
const CHANGED_CSS = "static/mokly-generated/styles/changed.css";
const COMPACT_CSS = "static/mokly-generated/styles/compact.css";

test.use({ viewport: { width: 1440, height: 1000 } });

/** Count the selected comparison's review requests from the page's start. */
function reviewRequests(page: Page): { count: number } {
  const seen = { count: 0 };
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/review.json")) seen.count++;
  });
  return seen;
}

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

/**
 * Every fact in Details: the section's own sentences, then each changed file
 * with its nested sentences and styles.
 */
function facts(evidence: Locator) {
  return evidence.evaluate((panel) => ({
    sentences: [...panel.querySelectorAll(":scope > p")].map(
      (sentence) => sentence.textContent?.trim() ?? "",
    ),
    files: [
      ...(panel.querySelector(".mbk-evidence-files")?.children ?? []),
    ].map((item) => [
      item.firstChild?.textContent?.trim() ?? "",
      [...item.querySelectorAll(":scope > p, :scope > ul code")].map(
        (part) => part.textContent?.trim() ?? "",
      ),
    ]),
  }));
}

test("Current, a loaded comparison and Changes show the same facts once", async ({
  page,
  request,
  baseURL,
}) => {
  const requests = reviewRequests(page);
  await page.goto(`/view/${comparisonPaths.changed}/`);
  const evidence = await openEvidence(page);
  const expected = {
    sentences: [
      BASE,
      MATERIAL,
      "Changes to these files may affect this screen:",
      "Changed component: Card",
    ],
    files: [
      [CHANGED_CSS, [UNRESOLVED_LEAD, ":root"]],
      [THEME, [OUTSIDE_LEAD, ".accent"]],
    ],
  };
  // The detail's reasons arrive before any comparison is requested.
  await expect.poll(() => facts(evidence)).toEqual(expected);
  expect(requests.count).toBe(0);

  await showMode(page, "Side by side", 4);
  await expect(page.locator(".mbk-diff-view").first()).toBeVisible();
  expect(requests.count).toBeGreaterThan(0);
  await expect.poll(() => facts(evidence)).toEqual(expected);
  for (const once of [MATERIAL, OUTSIDE_LEAD, "Comparison details"])
    await expect(evidence.getByText(once, { exact: true })).toHaveCount(1);

  await modeButton(page, "Current").click();
  await expect(modeButton(page, "Current")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect.poll(() => facts(evidence)).toEqual(expected);

  const included = changesPaths(await comparisonIndex(request, baseURL));
  await chooseFilter(page, "changed");
  await expect(
    page.locator('button[data-filter="changed"] .mbk-nav-filter-count'),
  ).toHaveText(String(included.length));
  await expect.poll(() => facts(evidence)).toEqual(expected);
});

test("classification evidence arrives first and survives the comparison", async ({
  page,
}) => {
  const requests = reviewRequests(page);
  await page.goto(`/view/${comparisonPaths.mobileOnlyChange}/`);
  const evidence = await openEvidence(page);
  const expected = {
    sentences: [BASE, "Changes to these files may affect this screen:"],
    files: [[COMPACT_CSS, [MATCHED_LEAD, ".auth"]]],
  };
  await expect.poll(() => facts(evidence)).toEqual(expected);
  await expect(evidence.locator("code.mbk-code")).toHaveText([".auth"]);
  expect(requests.count).toBe(0);

  const response = page.waitForResponse(
    (candidate) =>
      candidate.status() === 200 &&
      new URL(candidate.url()).pathname.endsWith("/review.json"),
  );
  await showMode(page, "Side by side", 4);
  expect(parseReviewResult(await (await response).json()).schemaVersion).toBe(
    8,
  );
  await expect(page.locator(".mbk-diff-view").first()).toBeVisible();
  await expect(evidence.locator("code.mbk-code")).toHaveText([".auth"]);
  await expect(
    evidence.getByText("Comparison details", { exact: true }),
  ).toHaveCount(1);
  await expect(evidence).not.toContainText("Shared component changes");
  await expect.poll(() => facts(evidence)).toEqual(expected);
  await modeButton(page, "Current").click();
  await expect(evidence.locator("code.mbk-code")).toHaveText([".auth"]);
  await expect.poll(() => facts(evidence)).toEqual(expected);
});
