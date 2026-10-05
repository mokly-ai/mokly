import { expect, test, type Page } from "@playwright/test";

import {
  branchCatalogue,
  startBranchHost,
  type BranchHost,
} from "./branch_hosts.js";
import { readDisclosureStorage } from "./disclosure_storage.js";

const parent = "gallery/home";
const listKey = `variants:${parent}`;
const list = `[data-nav-disclosure="${listKey}"]`;
const toggle = '[data-nav-variants-label="Home"]';
const source = (changed: boolean) => `import {defineScreen} from '@mokly/mokly';
export default defineScreen({title:'Home',description:'Home',dependencies:[],relatedDocs:[],tags:['parent'],mobile:<main>Home</main>,desktop:<main>Home</main>,variants:[{slug:'empty',title:'Empty',description:'Empty',tags:['variant'],mobile:<main>${changed ? "Changed empty" : "Empty"}</main>,desktop:<main>${changed ? "Changed empty" : "Empty"}</main>}]});`;
const screen = (title: string) => `import {defineScreen} from '@mokly/mokly';
export default defineScreen({title:'${title}',description:'${title}',dependencies:[],relatedDocs:[],mobile:<main>${title}</main>,desktop:<main>${title}</main>});`;
const parentOnly = source(false).replace("title:'Home'", "title:'Parent only'");

let host: BranchHost;
test.beforeAll(async () => {
  test.setTimeout(180_000);
  host = await startBranchHost("serve", () =>
    branchCatalogue(
      {
        "specs/gallery/home.mockup.tsx": source(false),
        "specs/details.mockup.tsx": screen("Details"),
        "specs/parent-only.mockup.tsx": parentOnly,
        "specs/hidden/index.mockup.tsx": screen("Hidden contents"),
        "specs/hidden/secret/_folder.json": '{"hidden":true}',
        "specs/hidden/secret/item.mockup.tsx": screen("Secret"),
      },
      '{mockupsDir:"mockups",roots:[{dir:"specs"}],generatedOutput:"committed",colorSchemes:["light"]}',
      async (fixture) => {
        await fixture.write("specs/gallery/home.mockup.tsx", source(true));
        await fixture.write(
          "specs/parent-only.mockup.tsx",
          parentOnly.replace(
            "description:'Home'",
            "description:'Updated parent'",
          ),
        );
      },
    ),
  );
});
test.afterAll(async () => {
  await host?.close();
});

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await host.open(page, "details");
  if (width < 900)
    await page
      .getByRole("button", { name: "Open catalogue navigation" })
      .click();
  await expect(page.locator(toggle)).toHaveAttribute("aria-expanded", "false");
}

for (const width of [1280, 390]) {
  for (const filter of ["All", "search", "Changes"] as const) {
    test(`${width}px ${filter}: Hide, Show, and Collapse all close the list`, async ({
      page,
    }) => {
      await open(page, width);
      if (filter === "search")
        await page.locator("[data-mokly-search]").fill("tag:variant");
      if (filter === "Changes") await page.click('[data-filter="changed"]');
      if (filter === "All") await page.locator(toggle).click();
      await expect(page.locator(toggle)).toHaveAttribute(
        "aria-label",
        "Hide variants of Home",
      );
      await expect(page.locator(list)).toBeVisible();
      await page.locator(toggle).click();
      await expect(page.locator(toggle)).toHaveAttribute(
        "aria-label",
        "Show variants of Home",
      );
      await expect(page.locator(list)).toBeHidden();
      await page.locator(toggle).click();
      await expect(page.locator(list)).toBeVisible();
      await page.getByRole("button", { name: "Collapse all" }).click();
      await expect(page.locator(toggle)).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await expect(page.locator(list)).toBeHidden();
    });
  }

  test(`${width}px: reload keeps an unrelated saved list closed`, async ({
    page,
  }) => {
    await open(page, width);
    await page.locator(toggle).click();
    await page.locator(toggle).click();
    await expect
      .poll(() => readDisclosureStorage(page))
      .toMatchObject({ [listKey]: false });
    await page.reload();
    if (width < 900)
      await page
        .getByRole("button", { name: "Open catalogue navigation" })
        .click();
    await expect(page.locator(toggle)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(page.locator(list)).toBeHidden();
  });

  test(`${width}px: no button without a visible row in All or search`, async ({
    page,
  }) => {
    await open(page, width);
    await expect(
      page.locator('[data-nav-variants-label="Hidden contents"]'),
    ).toHaveCount(0);
    await page.locator("[data-mokly-search]").fill("tag:parent");
    await expect(page.locator(`a[data-entry-id="${parent}"]`)).toBeVisible();
    await expect(page.locator(toggle)).toHaveCount(0);
    await page.locator("[data-mokly-search]").fill("tag:variant");
    await expect(page.locator(toggle)).toHaveAttribute("aria-expanded", "true");
    await page.locator(toggle).click();
    await page.locator("[data-mokly-search]").fill("tag:variant empty");
    await expect(page.locator(toggle)).toHaveAttribute("aria-expanded", "true");
  });
  test(`${width}px Changes: a changed parent has no button without a matching variant`, async ({
    page,
  }) => {
    await open(page, width);
    await page.click('[data-filter="changed"]');
    await expect(page.locator('a[data-entry-id="parent-only"]')).toBeVisible();
    await expect(
      page.locator('[data-nav-variants-label="Parent only"]'),
    ).toHaveCount(0);
  });
}
