import { expect, test } from "@playwright/test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import type { CatalogueUpdate } from "../../dist/server/update_messages.js";
import { createFixture, removeFixture } from "../helpers/fixture.js";

for (const mobile of [false, true]) {
  test(`Preparing a comparison keeps All usable and the layout fixed (${mobile ? "mobile" : "desktop"})`, async ({
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
      changesStatus: "preparing",
    });
    const publish = (update: CatalogueUpdate) =>
      server.publishUpdate({ ...update, kind: "evidence" });
    try {
      await page.setViewportSize(
        mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      );
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${server.url}/view/screens/home.html`);
      if (mobile) await page.locator("[data-mokly-menu]").click();
      const all = page.locator('[data-filter="all"]');
      const changes = page.locator('[data-filter="changed"]');
      const filter = page.locator("[data-mokly-filter]");
      const tree = page.locator("[data-mokly-nav-scroll]");
      const status = page.locator("[data-nav-status]");
      await expect(changes.locator(".mbk-nav-spinner")).toHaveAccessibleName(
        "Preparing comparison",
      );
      await expect(
        page.locator('[data-nav-row][data-route="screens/home.html"]'),
      ).toBeVisible();
      const initialFilter = await filter.boundingBox();
      const initialTree = await tree.boundingBox();

      await changes.click();
      await expect(status).toBeVisible();
      await expect(status.locator(".mbk-nav-status-title")).toHaveText(
        "Preparing comparison",
      );
      await expect(status.locator(".mbk-nav-status-detail")).toHaveText(
        "This takes a moment. You can keep browsing All while it finishes.",
      );
      await expect(tree).toHaveAttribute("aria-busy", "true");
      await expect(page.locator("a[data-nav-row]:visible")).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath("preparing.png") });
      await all.click();
      await expect(status).toBeHidden();
      await expect(
        page.locator('[data-nav-row][data-route="screens/home.html"]'),
      ).toBeVisible();
      expect(await filter.boundingBox()).toEqual(initialFilter);
      expect(await tree.boundingBox()).toEqual(initialTree);

      await changes.click();
      publish({ changedIds: null, changesStatus: "pending" });
      await expect(filter).toHaveAttribute("data-changes-status", "pending");
      await expect(status).toContainText("Checking for changes");
      await expect(status.locator(".mbk-nav-status-detail")).toHaveCount(0);
      await expect(changes).toHaveAttribute("aria-pressed", "true");

      publish({
        changedIds: ["details"],
        changesStatus: "ready",
      });
      await expect(changes.locator(".mbk-nav-filter-count")).toHaveText("1");
      await expect(status).toBeHidden();

      await page.locator("[data-mokly-search]").fill("details");
      await page
        .locator("html")
        .evaluate((root) => root.setAttribute("data-test-retained", "true"));
      publish({ changesStatus: "preparing" });
      await expect(filter).toHaveAttribute("data-changes-status", "preparing");
      await expect(status.locator(".mbk-nav-status-title")).toHaveText(
        "Preparing comparison",
      );
      await expect(page.locator("[data-mokly-search]")).toBeFocused();
      await expect(page.locator("[data-mokly-search]")).toHaveValue("details");
      await expect(page.locator("html")).toHaveAttribute(
        "data-test-retained",
        "true",
      );
      expect(await filter.boundingBox()).toEqual(initialFilter);

      publish({ changesStatus: "unavailable" });
      await expect(status).toContainText("Changes are unavailable");
      await expect(page.locator(".mbk-nav-spinner")).toHaveCount(0);
      await expect(status.locator(".mbk-nav-status-detail")).toHaveCount(0);
      await expect(changes.locator(".mbk-nav-filter-count")).toHaveText("—");
      await page.screenshot({ path: testInfo.outputPath("failed.png") });
      await all.click();
      await expect(status).toBeHidden();
      expect(await filter.boundingBox()).toEqual(initialFilter);
      expect(await tree.boundingBox()).toEqual(initialTree);

      await page.emulateMedia({ reducedMotion: "reduce" });
      publish({ changesStatus: "preparing" });
      await expect(changes.locator(".mbk-nav-spinner")).toHaveCSS(
        "animation-name",
        "none",
      );
      expect(errors).toEqual([]);
    } finally {
      await server.close();
      await removeFixture(fixture);
    }
  });
}
