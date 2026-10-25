import { expect, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import { serveCatalogue } from "./catalogue_fixture.js";
let host: Awaited<ReturnType<typeof serveCatalogue>>;
test.beforeAll(async () => {
  const screen = (title: string, tags: string[] = []) => `---
title: ${title}
tags: ${JSON.stringify(tags)}
---
<h1>${title}</h1>`;
  host = await serveCatalogue({
    "specs/home.screen.html": screen("Home"),
    "specs/shop/_folder.json": '{"title":"Shop"}',
    "specs/shop/cart.screen.html": screen("Cart", ["sale"]),
    "specs/shop/checkout.screen.html": screen("Checkout"),
    "specs/shop/receipt.screen.html": screen("Receipt"),
    "specs/shop/archive/_folder.json": '{"title":"Archive"}',
    "specs/shop/archive/orders.screen.html": screen("Orders"),
  });
});
test.afterAll(async () => host?.close());
/**
 * One folder's count and the child rows it shows, or null when the folder is
 * hidden. A collapsed folder still reports the rows its filter keeps.
 */
function folder(page: Page, path: string) {
  return page
    .locator(`nav.mbk-nav details[data-nav-folder="folder:${path}"]`)
    .evaluate((group) => {
      if (!group.checkVisibility()) return null;
      const rows = [...group.children].filter(
        (child) =>
          child.tagName !== "SUMMARY" &&
          !child.hasAttribute("hidden") &&
          getComputedStyle(child).display !== "none",
      );
      return {
        count:
          group.querySelector(":scope > summary .mbk-nav-count")?.textContent ??
          null,
        rows: rows.map((row) => {
          const label = (
            row.matches("details")
              ? row.querySelector(":scope > summary .mbk-nav-label")!
              : row
          ).cloneNode(true) as Element;
          for (const wording of label.querySelectorAll(
            "[data-nav-changed-text]",
          ))
            wording.remove();
          return label.textContent?.trim() ?? "";
        }),
      };
    });
}

async function expectFolders(
  page: Page,
  expected: Readonly<
    Record<string, { count: string; rows: readonly string[] } | null>
  >,
): Promise<void> {
  for (const [path, value] of Object.entries(expected))
    await expect
      .poll(() => folder(page, path), { message: path })
      .toEqual(value);
}

test("All counts every child row a folder shows", async ({ page }) => {
  await page.goto(`${host.url}/view/home/`);
  await expectFolders(page, {
    shop: { count: "4", rows: ["Archive", "Cart", "Checkout", "Receipt"] },
    "shop/archive": { count: "1", rows: ["Orders"] },
  });
});

test("search and tags count only the child rows they keep", async ({
  page,
}) => {
  await page.goto(`${host.url}/view/home/`);
  const search = page.locator("[data-mokly-search]");
  for (const [query, expected] of [
    ["checkout", { shop: { count: "1", rows: ["Checkout"] } }],
    [
      "orders",
      {
        shop: { count: "1", rows: ["Archive"] },
        "shop/archive": { count: "1", rows: ["Orders"] },
      },
    ],
    ["tag:sale", { shop: { count: "1", rows: ["Cart"] } }],
  ] as const) {
    await search.fill(query);
    await expectFolders(page, expected);
  }
  await search.fill("");
  await expectFolders(page, {
    shop: { count: "4", rows: ["Archive", "Cart", "Checkout", "Receipt"] },
  });
});
