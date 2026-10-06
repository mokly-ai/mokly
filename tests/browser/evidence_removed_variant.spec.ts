import { expect, test } from "@playwright/test";

import { compileCatalogue } from "../../packages/mokly/dist/build/compile.js";
import { loadConfig } from "../../packages/mokly/dist/config/load.js";
import { startEvidenceFixture } from "../helpers/evidence_fixture.js";
import { createFixture, removeFixture } from "../helpers/fixture.js";
import { screenVariantEntrySource } from "../helpers/screen_variant_fixture.js";

const ROUTE = "home/empty/index.html";
const ROW = `a[data-nav-row][data-route="${ROUTE}"]`;
const LIST = '[data-nav-disclosure="variants:home"]';
const HOME = 'a[data-nav-row][data-route="home/index.html"]';

test("a background baseline places a removed variant under its parent", async ({
  page,
}) => {
  const fixture = await startEvidenceFixture(
    screenVariantEntrySource({ includeVariant: false }),
  );
  const before = await createFixture(screenVariantEntrySource());
  try {
    const { manifest: baseline } = await compileCatalogue(
      await loadConfig(before.root),
    );
    const current = fixture.compilation.manifest;
    const publish = (
      entries: (typeof baseline)["entries"],
      changedEntries: string[],
    ) =>
      fixture.server.publishUpdate({
        kind: "evidence",
        changesStatus: "ready",
        changedEntries,
        componentChanges: {
          baseline: { ...baseline, entries },
          changedEntries,
        },
      });

    await page.goto(`${fixture.server.url}/view/home/`);
    await expect(page.locator(ROW)).toHaveCount(0);
    await expect(page.locator(LIST)).toHaveCount(0);

    publish(baseline.entries, ["home/empty"]);

    await expect(page.locator(`${LIST} ${ROW}`)).toHaveCount(1);
    await expect(page.locator(HOME)).toHaveAttribute("aria-current", "page");
    await expect(page.locator(HOME)).toHaveAttribute(
      "data-changed-variants",
      "true",
    );
    await expect(page.locator(ROW)).toBeHidden();

    await page.click('[data-filter="changed"]');

    await expect(page.locator(ROW)).toBeVisible();
    await expect(page.locator(ROW)).toContainText("Home empty · Removed");
    await expect(page.locator(HOME)).toBeVisible();

    await page.fill("[data-mokly-search]", "Home empty");

    await expect(page.locator(ROW)).toBeVisible();
    await expect(page.locator(HOME)).toBeVisible();
    await expect(
      page.locator('a[data-nav-row][data-route="details/index.html"]'),
    ).toBeHidden();

    await page.fill("[data-mokly-search]", "");
    const retained = await page.locator(ROW).elementHandle();

    publish(baseline.entries, ["home/empty"]);

    expect(await retained!.evaluate((row) => row.isConnected)).toBe(true);
    await expect(page.locator(ROW)).toHaveCount(1);

    await page.click('[data-filter="all"]');
    publish(current.entries, []);

    await expect(page.locator(ROW)).toHaveCount(0);
    await expect(page.locator(LIST)).toHaveCount(0);
    await expect(page.locator(HOME)).toHaveAttribute("aria-current", "page");
    await expect(page.locator(HOME)).not.toHaveAttribute(
      "data-changed-variants",
      "true",
    );
  } finally {
    await removeFixture(before);
    await fixture.close();
  }
});
