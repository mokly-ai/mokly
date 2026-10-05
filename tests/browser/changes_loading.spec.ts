import { expect, test } from "@playwright/test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import type { CatalogueUpdate } from "../../dist/server/update_messages.js";
import { createFixture, removeFixture } from "../helpers/fixture.js";

for (const mobile of [false, true]) {
  test(`Changes loading preserves navigation layout and selection (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }, testInfo) => {
    const fixture = await createFixture();
    const config = await loadConfig(fixture.root);
    const compilation = await compileCatalogue(config);
    await writeCompilation(compilation, config);
    const server = await startCatalogueServer(config, {
      base: "main",
      port: 0,
      manifest: compilation.manifest,
      changesStatus: "pending",
    });
    const publish = (update: CatalogueUpdate) =>
      server.publishUpdate({ ...update, kind: "evidence" });
    try {
      await page.setViewportSize(
        mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      );
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${server.url}/view/home/`);
      await page
        .locator("html")
        .evaluate((root) => root.setAttribute("data-test-retained", "true"));
      if (mobile) await page.locator("[data-mokly-menu]").click();
      const all = page.locator('[data-filter="all"]');
      const changes = page.locator('[data-filter="changed"]');
      const filter = page.locator("[data-mokly-filter]");
      const tree = page.locator("[data-mokly-nav-scroll]");
      const status = page.locator("[data-nav-status]");
      await expect(all).toBeVisible();
      await expect(changes).toBeVisible();
      await expect(changes.locator(".mbk-nav-spinner")).toBeVisible();
      await expect(
        page.locator('[data-nav-row][data-route="home/index.html"]'),
      ).toBeVisible();
      const initialFilter = await filter.boundingBox();
      const initialTree = await tree.boundingBox();
      await page.screenshot({ path: testInfo.outputPath("all-pending.png") });
      await changes.click();
      await expect(status).toBeVisible();
      await expect(status).toContainText("Checking for changes");
      await expect(page.locator("a[data-nav-row]:visible")).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath("pending.png") });
      await all.click();
      await expect(status).toBeHidden();
      await changes.click();

      publish({
        changedEntries: ["details"],
        changesStatus: "ready",
      });
      await expect(filter).toHaveAttribute("data-changes-status", "ready");
      await expect(changes).toHaveAttribute("aria-pressed", "true");
      await expect(changes.locator(".mbk-nav-filter-count")).toHaveText("1");
      await expect(
        page.locator('[data-nav-row][data-route="details/index.html"]'),
      ).toBeVisible();
      await expect(status).toBeHidden();
      expect(await filter.boundingBox()).toEqual(initialFilter);
      expect(await tree.boundingBox()).toEqual(initialTree);

      publish({ changedEntries: null, changesStatus: "pending" });
      await expect(status).toContainText("Checking for changes");
      await expect(changes).toHaveAttribute("aria-pressed", "true");
      publish({ changedEntries: [], changesStatus: "ready" });
      await expect(changes.locator(".mbk-nav-filter-count")).toHaveText("0");
      await expect(changes).toHaveAttribute("aria-pressed", "true");
      await expect(status).toContainText("No changes found");
      expect(await filter.boundingBox()).toEqual(initialFilter);

      publish({ changedEntries: null, changesStatus: "pending" });
      await expect(filter).toHaveAttribute("data-changes-status", "pending");
      publish({ changesStatus: "unavailable" });
      await expect(status).toContainText("Changes are unavailable");
      await expect(page.locator(".mbk-nav-spinner")).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath("unavailable.png") });
      await all.click();
      await expect(status).toBeHidden();
      await expect(
        page.locator('[data-nav-row][data-route="home/index.html"]'),
      ).toBeVisible();
      expect(await filter.boundingBox()).toEqual(initialFilter);
      await page.emulateMedia({ reducedMotion: "reduce" });
      publish({ changedEntries: null, changesStatus: "pending" });
      await expect(changes.locator(".mbk-nav-spinner")).toHaveCSS(
        "animation-name",
        "none",
      );
      await page.waitForLoadState("load");
      await changes.focus();
      await expect(changes).toBeFocused();
      await page.keyboard.press("Space");
      await expect(status).toBeVisible();
      expect(errors).toEqual([]);
      await expect(page.locator("html")).toHaveAttribute(
        "data-test-retained",
        "true",
      );
    } finally {
      await server.close();
      await removeFixture(fixture);
    }
  });
}
