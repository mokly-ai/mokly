import { expect, test, type Page } from "@playwright/test";

import {
  branchCatalogue,
  startBranchHost,
  type BranchHost,
} from "./branch_hosts.js";

const screen = (title: string, body: string, tags: readonly string[] = []) =>
  `import {defineScreen} from '@mokly/mokly';
export default defineScreen({title:${JSON.stringify(title)},description:${JSON.stringify(title)},relatedDocs:[],tags:${JSON.stringify(tags)},mobile:<main><h1>${body}</h1></main>,desktop:<main><h1>${body}</h1></main>});`;

/**
 * A Shop folder whose Cart (tagged `sale`) changed on the branch, beside the
 * unchanged Checkout and Receipt and an Archive folder holding Orders.
 */
function shopCatalogue() {
  return branchCatalogue(
    {
      "specs/home.mockup.tsx": screen("Home", "Home"),
      "specs/shop/_folder.json": '{"title":"Shop"}',
      "specs/shop/cart.mockup.tsx": screen("Cart", "Cart", ["sale"]),
      "specs/shop/checkout.mockup.tsx": screen("Checkout", "Checkout"),
      "specs/shop/receipt.mockup.tsx": screen("Receipt", "Receipt"),
      "specs/shop/archive/_folder.json": '{"title":"Archive"}',
      "specs/shop/archive/orders.mockup.tsx": screen("Orders", "Orders"),
    },
    '{mockupsDir:"mockups",roots:[{dir:"specs"}],colorSchemes:["light"]}',
    async (fixture) => {
      await fixture.write(
        "specs/shop/cart.mockup.tsx",
        screen("Cart", "Cart, with a coupon", ["sale"]),
      );
    },
  );
}

let host: BranchHost;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  host = await startBranchHost("serve", shopCatalogue);
});

test.afterAll(async () => {
  if (host) await host.close();
});

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
  await host.open(page, "home");
  await expectFolders(page, {
    shop: { count: "4", rows: ["Archive", "Cart", "Checkout", "Receipt"] },
    "shop/archive": { count: "1", rows: ["Orders"] },
  });
});

test("Changes counts only the child rows it keeps", async ({ page }) => {
  await host.open(page, "home");
  await page.click('[data-filter="changed"]');
  await expectFolders(page, {
    shop: { count: "1", rows: ["Cart"] },
    "shop/archive": null,
  });
  await page.click('[data-filter="all"]');
  await expectFolders(page, {
    shop: { count: "4", rows: ["Archive", "Cart", "Checkout", "Receipt"] },
  });
});

test("search and tags count only the child rows they keep", async ({
  page,
}) => {
  await host.open(page, "home");
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
