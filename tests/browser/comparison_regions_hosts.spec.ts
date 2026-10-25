/**
 * Scroll together outside Serve, under the Scroll together contract. On the
 * copied comparison output, the choice persists in local storage across a
 * reload. An embedded viewer keeps the choice for its mount, without
 * storage, across screens and a source replacement, through both frame
 * adapters; a new mount starts with the switch on.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import {
  comparisonSection,
  expectRegionsAt,
  openComparison,
  paneFrame,
  regionOffset,
  scrollTogether,
  settleRegion,
  wheelOverRegion,
} from "./comparison_scroll.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { modeButton, navRow } from "./comparison_ui.js";
import {
  comparisonViewerHost,
  openEmbeddedComparison,
  type ComparisonViewerHost,
} from "./comparison_viewer_host.js";
import { chooseViewport } from "./workspace_actions.js";

const STORAGE_KEY = "mokly:comparison-scroll-together";
const changed = comparisonPaths.changed;
const panel = "#panel";

/** A panel scrolled in Current leaves Before's panel in place. */
async function expectApart(page: Page, section: Locator): Promise<void> {
  const before = await regionOffset(paneFrame(section, "before"), panel);
  const after = await regionOffset(paneFrame(section, "after"), panel);
  await wheelOverRegion(page, paneFrame(section, "after"), panel, 80);
  await settleRegion(page, paneFrame(section, "after"), panel, after.y + 80);
  expect(await regionOffset(paneFrame(section, "before"), panel)).toEqual(
    before,
  );
}

test("a static export mirrors panels and remembers Scroll together", async ({
  page,
}) => {
  await openComparison(page, changed, "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  await wheelOverRegion(page, paneFrame(desktop, "after"), panel, 300);
  await expectRegionsAt(desktop, panel, [300, 300]);
  await scrollTogether(page).click();
  await expect(scrollTogether(page)).not.toBeChecked();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe("off");

  await page.reload();
  await chooseViewport(page, "desktop");
  await modeButton(page, "Overlay").click();
  await expect(scrollTogether(page)).not.toBeChecked();
  await expect(paneFrame(desktop, "after")).toBeVisible();
  await expectApart(page, desktop);
});

test.describe("embedded viewer", () => {
  let host: ComparisonViewerHost;
  test.beforeAll(async () => {
    host = await comparisonViewerHost();
  });
  test.afterAll(async () => {
    await host?.close();
  });

  for (const adapter of ["same-origin", "cross"] as const)
    test(`an embedded viewer keeps Scroll together for its mount through the ${adapter} adapter`, async ({
      page,
    }) => {
      // Record every storage key that the page reads or writes.
      await page.addInitScript(() => {
        const keys: string[] = [];
        Object.assign(window, { storageKeys: keys });
        for (const name of ["getItem", "setItem", "removeItem"] as const) {
          const original = Storage.prototype[name] as (
            ...values: unknown[]
          ) => unknown;
          Object.defineProperty(Storage.prototype, name, {
            configurable: true,
            value(this: Storage, ...values: unknown[]) {
              keys.push(String(values[0]));
              return original.apply(this, values);
            },
          });
        }
      });
      await openEmbeddedComparison(
        page,
        `${host.url}/viewer.html?adapter=${adapter}&entry=${changed}`,
        "desktop",
        "Overlay",
      );
      const desktop = comparisonSection(page, "desktop");
      await wheelOverRegion(page, paneFrame(desktop, "after"), panel, 300);
      await expectRegionsAt(desktop, panel, [300, 300]);
      await scrollTogether(page).click();
      await expect(scrollTogether(page)).not.toBeChecked();
      await expectApart(page, desktop);

      // Another screen of the same mount keeps the choice.
      await navRow(page, comparisonPaths.lightOnly).click();
      await expect(page.locator(".mbk-screen-head h2")).toHaveText(
        "Daylight screen",
      );
      await modeButton(page, "Overlay").click();
      await expect(scrollTogether(page)).not.toBeChecked();
      await navRow(page, changed).click();
      await modeButton(page, "Overlay").click();
      await expect(scrollTogether(page)).not.toBeChecked();
      await expectApart(page, desktop);

      // A source replacement remounts the shell and keeps the choice.
      await page.evaluate(() =>
        (window as unknown as { replaceSource: () => void }).replaceSource(),
      );
      await chooseViewport(page, "desktop");
      await modeButton(page, "Overlay").click();
      await expect(scrollTogether(page)).not.toBeChecked();
      await expectApart(page, desktop);
      expect(
        await page.evaluate(
          () => (window as unknown as { storageKeys: string[] }).storageKeys,
        ),
      ).not.toContain(STORAGE_KEY);

      // A new mount starts with the switch on.
      await page.reload();
      await chooseViewport(page, "desktop");
      await modeButton(page, "Overlay").click();
      await expect(scrollTogether(page)).toBeChecked();
    });
});
