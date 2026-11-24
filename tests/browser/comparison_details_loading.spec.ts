/**
 * Details while a destination's entry detail loads, on the copied comparison
 * output, under the shell delivery and CSS evidence contracts: the heading
 * and the review base come from the index, so they show at once and stay; in
 * the Changes tab the Compared rail names the branch point in place of the
 * details' sentence. The changed component that affects the screen comes
 * from the detail, so it shows only after the detail arrives.
 */

import { expect, type Page, type Route } from "@playwright/test";

import {
  INSPECTOR_VIEWPORTS,
  RAIL_BASE,
  expectRailBase,
  openChangesEvidence,
} from "./comparison_evidence_page.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { navRow } from "./comparison_ui.js";
import { openCatalogueSheet } from "./workspace_actions.js";

/** Only the destination's detail names the changed component. */
const LOADED = "Changed component: Card";
const DESTINATION = `/view/${comparisonPaths.changed}/`;

/**
 * Record the Compared rail's first version while the Details show, after
 * every DOM change on the destination route, so a branch point that leaves
 * and returns is seen.
 */
async function recordRailBases(page: Page): Promise<void> {
  await page.evaluate((destination) => {
    const seen: (string | null)[] = [];
    Object.assign(window, { railBases: seen });
    new MutationObserver(() => {
      if (location.pathname !== destination) return;
      const evidence = document.querySelector("[data-workspace-evidence]");
      if (!evidence || evidence.hasAttribute("hidden")) return;
      const rail = document.querySelector('section[aria-label="Compared"]');
      seen.push(rail?.querySelector("li")?.textContent ?? null);
    }).observe(document, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
  }, DESTINATION);
}

function railBases(page: Page): Promise<(string | null)[]> {
  return page.evaluate(
    () => (window as unknown as { railBases: (string | null)[] }).railBases,
  );
}

for (const [name, size] of INSPECTOR_VIEWPORTS)
  test.describe(`${name} copied navigation`, () => {
    test.use({ viewport: size });

    test("Details keep the review base while the screen's detail loads, and the changed component arrives with it", async ({
      page,
    }) => {
      const held: Route[] = [];
      let reads = 0;
      await page.route(
        `**/mokly-viewer/entries/${comparisonPaths.changed}.json`,
        (route) => {
          reads += 1;
          if (held.length) return route.continue();
          held.push(route);
        },
      );
      await page.goto(`/view/${comparisonPaths.component}/`);
      // The heading and the branch point show on the origin.
      await openChangesEvidence(page);
      await recordRailBases(page);

      if (name === "mobile") await openCatalogueSheet(page);
      await navRow(page, comparisonPaths.changed).click();
      await expect(page).toHaveURL(new RegExp(`${DESTINATION}$`, "u"));
      await expect.poll(() => held.length).toBe(1);
      // They show again at once while the destination's detail is held.
      const temporary = await openChangesEvidence(page);
      await expect(temporary).not.toContainText(LOADED);

      await held[0]!.continue();
      await expect(temporary.getByText(LOADED, { exact: true })).toBeVisible();
      await expectRailBase(page, temporary);
      expect(reads).toBe(1);
      const recorded = await railBases(page);
      expect(recorded.length).toBeGreaterThan(0);
      expect([...new Set(recorded)]).toEqual([RAIL_BASE]);
    });
  });
