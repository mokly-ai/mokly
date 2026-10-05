import { expect, test, type Locator, type Page } from "@playwright/test";

import { comparisonRegionsExport } from "../helpers/comparison_regions_fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import {
  comparisonSection,
  openComparison,
  paneFrame,
} from "./comparison_alignment_helpers.js";
import {
  expectRegionsAt,
  regionOffset,
  scrollTogether,
  settleRegion,
  wheelOverRegion,
} from "./comparison_regions_helpers.js";
import { hostExportedViewer, type HostedViewer } from "./viewer_host.js";
import { chooseViewport } from "./workspace_actions.js";

let exported: Awaited<ReturnType<typeof comparisonRegionsExport>>;
let site: Awaited<ReturnType<typeof serveStaticFiles>>;
let viewer: HostedViewer;

test.describe.configure({ timeout: 90_000 });
test.beforeAll(async () => {
  test.setTimeout(240_000);
  exported = await comparisonRegionsExport();
  site = await serveStaticFiles(exported.output);
  viewer = await hostExportedViewer(exported.output);
});
test.afterAll(async () => {
  await viewer?.close();
  await site?.close();
  await exported?.close();
});

const STORAGE_KEY = "mokly:comparison-scroll-together";

/** Expect a panel scrolled in Current to leave Before's panel in place. */
async function expectApart(
  page: Page,
  section: Locator,
  selector: string,
): Promise<void> {
  const before = await regionOffset(paneFrame(section, "before"), selector);
  const after = await regionOffset(paneFrame(section, "after"), selector);
  await wheelOverRegion(page, paneFrame(section, "after"), selector, 80);
  await settleRegion(page, paneFrame(section, "after"), selector, {
    y: after.y + 80,
  });
  expect(await regionOffset(paneFrame(section, "before"), selector)).toEqual(
    before,
  );
}

test("a static export mirrors panels and remembers Scroll together", async ({
  page,
}) => {
  await openComparison(
    page,
    `${site.url}/view/shell/`,
    "desktop",
    "Overlay",
    "static",
  );
  const desktop = comparisonSection(page, "desktop");
  await wheelOverRegion(page, paneFrame(desktop, "after"), ".rg-main", 300);
  await expectRegionsAt(desktop, ".rg-main", [300, 300]);
  await scrollTogether(page).click();
  await expect(scrollTogether(page)).not.toBeChecked();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe("off");

  await page.reload();
  await page.getByRole("button", { name: "Overlay", exact: true }).click();
  await expect(scrollTogether(page)).not.toBeChecked();
  await expect(paneFrame(desktop, "after")).toBeVisible();
  await expectApart(page, desktop, ".rg-nav");
});

for (const adapter of ["same-origin", "cross"] as const)
  test(`an embedded viewer keeps Scroll together for its mount through the ${adapter} adapter`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const keys: string[] = [];
      (window as unknown as { storageKeys: string[] }).storageKeys = keys;
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
    const address = `${viewer.url}/viewer.html?adapter=${adapter}&entry=shell`;
    await openComparison(page, address, "desktop", "Overlay", "static");
    const desktop = comparisonSection(page, "desktop");
    await wheelOverRegion(page, paneFrame(desktop, "after"), ".rg-main", 300);
    await expectRegionsAt(desktop, ".rg-main", [300, 300]);
    await scrollTogether(page).click();
    await expect(scrollTogether(page)).not.toBeChecked();
    await expectApart(page, desktop, ".rg-main");

    await page.locator('#viewer a[data-route="solo/index.html"]').click();
    await page.getByRole("button", { name: "Overlay", exact: true }).click();
    await expect(scrollTogether(page)).not.toBeChecked();
    await expectApart(page, desktop, "#rg-solo");

    await page.evaluate(() =>
      (window as unknown as { replaceSource: () => void }).replaceSource(),
    );
    await chooseViewport(page, "desktop");
    await page.getByRole("button", { name: "Overlay", exact: true }).click();
    await expect(scrollTogether(page)).not.toBeChecked();
    await expectApart(page, desktop, ".rg-main");
    expect(
      await page.evaluate(
        () => (window as unknown as { storageKeys: string[] }).storageKeys,
      ),
    ).not.toContain(STORAGE_KEY);

    await page.reload();
    await chooseViewport(page, "desktop");
    await page.getByRole("button", { name: "Overlay", exact: true }).click();
    await expect(scrollTogether(page)).toBeChecked();
  });
