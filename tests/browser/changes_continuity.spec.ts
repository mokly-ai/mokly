import { expect, test, type Page } from "@playwright/test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import {
  createFixture,
  removeFixture,
  reparentedEntrySource,
} from "../helpers/fixture.js";

for (const mobile of [false, true]) {
  test(`background evidence preserves All without replacing documents (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    const source =
      reparentedEntrySource("screens") +
      `
      for (let i = 0; i < 40; i++) mockups.push(defineScreen({
        id: "extra-" + i, title: "Extra " + i, description: "Scroll fixture",
        route: "extra/" + i + ".html", mobile: <main>Extra {i}</main>,
        desktop: <main>Extra {i}</main>, useCaseIds: [], relatedDocs: []
      }));
    `;
    const fixture = await createFixture(source);
    const config = await loadConfig(fixture.root);
    const compilation = await compileCatalogue(config);
    await writeCompilation(compilation, config);
    const server = await startCatalogueServer(config, {
      base: "main",
      port: 0,
      manifest: compilation.manifest,
      changesStatus: "pending",
    });
    try {
      await page.setViewportSize(
        mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      );
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${server.url}/view/screens/home.html`);
      const frame = page.frameLocator(".mbk-frame-mobile iframe");
      await expect(frame.locator("#home-mobile")).toBeVisible();
      await frame
        .locator("body")
        .evaluate((body) => body.setAttribute("data-test-retained", "true"));
      if (mobile) await page.locator("[data-mokly-menu]").click();
      await page
        .locator('[data-nav-collection="collection:archive"] > summary')
        .click();
      await page
        .locator('[data-nav-collection="collection:screens"] > summary')
        .click();
      await page.locator('[data-nav-section="pages"] > summary').click();
      await page.locator("[data-mokly-nav-scroll]").evaluate((tree) => {
        tree.scrollTop = 120;
      });
      await page.locator('[data-filter="all"]').focus();
      await page
        .locator("html")
        .evaluate((root) => root.setAttribute("data-test-retained", "true"));
      const originalRows = await page.locator(".mbk-nav-row").elementHandles();
      const before = await navigationState(page);

      server.publishUpdate({ kind: "evidence" });
      await expect(page.locator("html")).toHaveAttribute(
        "data-mokly-update-version",
        "2",
      );
      expect(await navigationState(page)).toEqual(before);
      server.publishUpdate({ kind: "evidence", changesStatus: "preparing" });
      await expect(page.locator("[data-changes-status]")).toHaveAttribute(
        "data-changes-status",
        "preparing",
      );
      expect(await navigationState(page)).toEqual(before);
      await expect(page.locator('[data-filter="all"]')).toBeFocused();
      server.publishUpdate({
        kind: "evidence",
        changedRoutes: ["screens/details.html"],
        changesStatus: "ready",
      });
      await expect(page.locator(".mbk-nav-filter-count")).toHaveText("1");
      expect(await navigationState(page)).toEqual(before);
      await expect(page.locator("html")).toHaveAttribute(
        "data-test-retained",
        "true",
      );
      await expect(frame.locator("body")).toHaveAttribute(
        "data-test-retained",
        "true",
      );
      for (const row of originalRows)
        expect(await row.evaluate((node) => node.isConnected)).toBe(true);

      await page.locator("[data-mokly-search]").fill("tour");
      const searched = await navigationState(page);
      server.publishUpdate({
        kind: "evidence",
        changedRoutes: [],
        changesStatus: "ready",
      });
      await expect(page.locator(".mbk-nav-filter-count")).toHaveText("0");
      expect(await navigationState(page)).toEqual(searched);
      await expect(page.locator("[data-mokly-search]")).toBeFocused();
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Unmodified",
      );
      server.publishUpdate({ kind: "evidence", changesStatus: "unavailable" });
      await expect(page.locator("[data-changes-status]")).toHaveAttribute(
        "data-changes-status",
        "unavailable",
      );
      await expect(page.locator("[data-workspace-status]")).toBeHidden();
      expect(await navigationState(page)).toEqual(searched);
      expect(errors).toEqual([]);
    } finally {
      await server.close();
      await removeFixture(fixture);
    }
  });
}

async function navigationState(page: Page) {
  return page.evaluate(() => ({
    all: document
      .querySelector('[data-filter="all"]')
      ?.getAttribute("aria-pressed"),
    search: document.querySelector<HTMLInputElement>("[data-mokly-search]")
      ?.value,
    drawer:
      document.querySelector<HTMLElement>("[data-mokly-shell]")?.dataset[
        "drawer"
      ],
    scroll: document.querySelector("[data-mokly-nav-scroll]")?.scrollTop,
    groups: [
      ...document.querySelectorAll<HTMLDetailsElement>("[data-nav-disclosure]"),
    ].map((node) => [node.dataset["navDisclosure"], node.open, node.hidden]),
    rows: [...document.querySelectorAll<HTMLElement>(".mbk-nav-row")].map(
      (node) => ({
        text: node.textContent,
        visible: node.checkVisibility(),
        y: node.getBoundingClientRect().y,
      }),
    ),
  }));
}
