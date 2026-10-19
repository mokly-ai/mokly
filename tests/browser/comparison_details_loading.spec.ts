/**
 * Details while a destination's entry detail loads, on the copied comparison
 * output, under the shell delivery and CSS evidence contracts: the heading
 * and the review-base sentence come from the index, so they show at once and
 * stay; the changed component that affects the screen comes from the detail,
 * so it shows only after the detail arrives.
 */

import { expect, type Locator, type Page, type Route } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import { navRow } from "./comparison_ui.js";

const BASE = "Compared with the branch point on fixture-base.";
/** Only the destination's detail names the changed component. */
const LOADED = "Changed component: Card";
const DESTINATION = `/view/${comparisonPaths.changed}/`;
const INSPECTOR_VIEWPORTS = [
  ["desktop", { width: 1440, height: 1000 }],
  ["mobile", { width: 390, height: 844 }],
] as const;

/** Open the Details tab and return the comparison details it shows. */
async function openDetails(page: Page): Promise<Locator> {
  const tab = page.getByRole("tab", { name: "Details", exact: true });
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  const evidence = page.locator("[data-workspace-evidence]");
  await expect(evidence).toBeVisible();
  return evidence;
}

/**
 * Record the first Details paragraph after every DOM change on the
 * destination route, so a sentence that leaves and returns is seen.
 */
async function recordFirstParagraphs(page: Page): Promise<void> {
  await page.evaluate((destination) => {
    const seen: (string | null)[] = [];
    Object.assign(window, { firstParagraphs: seen });
    new MutationObserver(() => {
      if (location.pathname !== destination) return;
      const evidence = document.querySelector("[data-workspace-evidence]");
      if (!evidence || evidence.hasAttribute("hidden")) return;
      seen.push(evidence.querySelector("p")?.textContent ?? null);
    }).observe(document, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
  }, DESTINATION);
}

function firstParagraphs(page: Page): Promise<(string | null)[]> {
  return page.evaluate(
    () =>
      (window as unknown as { firstParagraphs: (string | null)[] })
        .firstParagraphs,
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
      const origin = await openDetails(page);
      await expect(origin.locator("p").first()).toHaveText(BASE);
      await recordFirstParagraphs(page);

      if (name === "mobile")
        await page
          .getByRole("button", { name: "Open catalogue navigation" })
          .click();
      await navRow(page, comparisonPaths.changed).click();
      await expect(page).toHaveURL(new RegExp(`${DESTINATION}$`, "u"));
      await expect.poll(() => held.length).toBe(1);
      const temporary = await openDetails(page);
      await expect(temporary.locator("p").first()).toHaveText(BASE);
      await expect(temporary).not.toContainText(LOADED);

      await held[0]!.continue();
      await expect(temporary.getByText(LOADED, { exact: true })).toBeVisible();
      await expect(temporary.locator("p").first()).toHaveText(BASE);
      expect(reads).toBe(1);
      const recorded = await firstParagraphs(page);
      expect(recorded.length).toBeGreaterThan(0);
      expect([...new Set(recorded)]).toEqual([BASE]);
    });
  });
