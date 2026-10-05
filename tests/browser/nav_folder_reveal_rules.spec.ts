import { expect, test } from "@playwright/test";

import { scaledTimeLimit } from "../helpers/time_limits.js";

import {
  branchCatalogue,
  startBranchHost,
  type BranchHost,
} from "./branch_hosts.js";

const screen = (title: string) => `import {defineScreen} from '@mokly/mokly';
export default defineScreen({title:'${title}',description:'${title}',dependencies:[],relatedDocs:[],mobile:<main>${title}</main>,desktop:<main>${title}</main>});`;

let host: BranchHost;
test.beforeAll(async () => {
  test.setTimeout(scaledTimeLimit(180_000));
  host = await startBranchHost("serve", () =>
    branchCatalogue(
      {
        "specs/pruned/secret/_folder.json": '{"hidden":true}',
        "specs/pruned/secret/item.mockup.tsx": screen("Item"),
        "specs/open/child.mockup.tsx": screen("Child"),
      },
      '{mockupsDir:"mockups",roots:[{dir:"specs"}],generatedOutput:"committed",colorSchemes:["light"]}',
      async (fixture) => {
        await fixture.write(
          "specs/pruned/secret/item.mockup.tsx",
          screen("Item").replace("<main>Item", "<main>Updated item"),
        );
      },
    ),
  );
});
test.afterAll(async () => {
  await host?.close();
});

for (const width of [1280, 390]) {
  for (const filter of ["All", "search", "Changes"] as const) {
    test(`${width}px ${filter}: a folder with only hidden descendants has plain crumbs`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await host.open(page, "pruned/secret/item");
      if (filter === "search")
        await page.locator("[data-mokly-search]").fill("zzz");
      if (filter === "Changes") {
        if (width < 900)
          await page
            .getByRole("button", { name: "Open catalogue navigation" })
            .click();
        await page.click('[data-filter="changed"]');
        if (width < 900)
          await page
            .getByRole("button", { name: "Open catalogue navigation" })
            .click();
      }
      const crumbs = page.getByLabel("Catalogue location");
      await expect(crumbs).toContainText("Pruned");
      await expect(crumbs).toContainText("Secret");
      await expect(crumbs.getByRole("button")).toHaveCount(0);
      await expect(crumbs.getByRole("link")).toHaveCount(0);
      await expect(page.locator("#mb-main h2")).toHaveText("Item");
      await expect(page.locator('[data-filter="changed"]')).toHaveAttribute(
        "aria-pressed",
        filter === "Changes" ? "true" : "false",
      );
      if (width < 900) await expect(page.locator("nav.mbk-nav")).toBeHidden();
    });

    test(`${width}px ${filter}: a visible folder crumb reveals its row`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await host.open(page, "open/child");
      if (filter === "search")
        await page.locator("[data-mokly-search]").fill("zzz");
      if (filter === "Changes") {
        if (width < 900)
          await page
            .getByRole("button", { name: "Open catalogue navigation" })
            .click();
        await page.click('[data-filter="changed"]');
        if (width < 900)
          await page
            .getByRole("button", { name: "Open catalogue navigation" })
            .click();
      }
      await page
        .getByLabel("Catalogue location")
        .getByRole("button", { name: "Open", exact: true })
        .click();
      const summary = page.locator(
        '[data-nav-disclosure="folder:specs:open"] > summary',
      );
      await expect(summary).toBeVisible();
      await expect(summary).toBeFocused();
      await expect(page.locator('[data-filter="all"]')).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(page.locator("[data-mokly-search]")).toHaveValue("");
      await expect(page).toHaveURL(/\/view\/open\/child\/$/);
      await expect(page.locator("#mb-main h2")).toHaveText("Child");
    });
  }
}
