import { expect, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import { serveCatalogue } from "./catalogue_fixture.js";
import { readDisclosureStorage } from "./disclosure_storage.js";

let server: Awaited<ReturnType<typeof serveCatalogue>>;
test.beforeAll(async () => {
  server = await serveCatalogue({
    "specs/index.mockup.tsx": `import React from "react";
import {defineFolder, definePage, defineScreen} from "@mokly/mokly";
const meta = {relatedDocs: []};
const shot = (id) => ({...meta, props: {id}, render: (props, context) => <main id={props.id + (context.viewport === "mobile" ? "-mobile" : "")}>{props.id}</main>});
export const guide = definePage({...meta, path: "fixture/guide", slug: "index", title: "Guide", description: "Guide index", render: () => '<!doctype html><html lang="en"><head><title>Guide</title></head><body><h1>Guide</h1></body></html>'});
export const intro = defineScreen({...shot("intro"), path: "fixture/guide/intro", title: "Intro", description: "Intro"});
export const invoice = defineScreen({...shot("invoice"), path: "fixture/billing/invoice", slug: "index", title: "Invoice", description: "Invoice", variants: [{slug: "overdue", title: "Overdue", description: "Overdue", props: {id: "overdue"}}]});
export const history = defineScreen({...shot("history"), path: "fixture/billing/invoice/history", title: "History", description: "History"});
export const old = defineScreen({...shot("old"), path: "fixture/billing/invoice/archive/old", title: "Old", description: "Old"});
export const setup = defineScreen({...shot("setup"), path: "fixture/tools/setup", title: "Setup", description: "Setup"});
export const billing = defineFolder({path: "fixture/billing", title: "Billing & Payments"});
`,
  });
});
test.afterAll(async () => server?.close());
function folder(page: Page, path: string) {
  return page.locator(`details[data-nav-folder="folder:${path}"]`);
}

test("a folder row only browses and its own page is the Overview row", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/fixture/guide/intro/`);
  const guide = folder(page, "fixture/guide");
  await expect(guide).toHaveAttribute("open", "");
  await guide.locator(":scope > summary").click();
  await expect(guide).not.toHaveAttribute("open", "");
  await expect(page).toHaveURL(/\/view\/fixture\/guide\/intro\/$/);
  await expect(page.locator("#mb-main h2")).toHaveText("Intro");
  await guide.locator(":scope > summary").click();
  const overview = guide.locator(":scope > a[data-nav-row]").first();
  await expect(overview).toHaveAccessibleName("Overview");
  await expect(overview).toHaveAttribute("data-nav-index", "");
  await expect(overview).toHaveAttribute("data-entry-id", "fixture/guide");
  await overview.click();
  await expect(page).toHaveURL(/\/view\/fixture\/guide\/$/);
  await expect(page.locator("#mb-main h2")).toHaveText("Guide");
  await expect(overview).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".mbk-crumbs")).toHaveText("Fixture");
});

test("a folder's own screen is one entry row listing its variants, then its members", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/fixture/billing/invoice/history/`);
  await expect(folder(page, "fixture/billing/invoice")).toHaveCount(0);
  const toggle = page.getByRole("button", { name: "Hide contents of Invoice" });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const list = page.locator(
    '[data-nav-disclosure="variants:fixture/billing/invoice"]',
  );
  expect(
    await list.evaluate((element) =>
      [...element.children].map(
        (child) =>
          child.getAttribute("data-entry-id") ??
          child.getAttribute("data-nav-folder"),
      ),
    ),
  ).toEqual([
    "fixture/billing/invoice/overdue",
    "folder:fixture/billing/invoice/archive",
    "fixture/billing/invoice/history",
  ]);
  await expect(
    list.locator(':scope > a[data-entry-id="fixture/billing/invoice/overdue"]'),
  ).toHaveAccessibleName("Overdue");
  await expect(
    list.locator(':scope > a[data-entry-id="fixture/billing/invoice/history"]'),
  ).toHaveAttribute("aria-current", "page");

  await toggle.click();
  await expect(list).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Show contents of Invoice" }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/\/view\/fixture\/billing\/invoice\/history\/$/);
  await expect
    .poll(() => readDisclosureStorage(page))
    .toMatchObject({ "variants:fixture/billing/invoice": false });

  await page.fill("[data-mokly-search]", "Old");
  await expect(list).toBeVisible();
  await expect(
    list.locator('a[data-entry-id="fixture/billing/invoice/archive/old"]'),
  ).toBeVisible();
  await expect(
    list.locator(':scope > a[data-entry-id="fixture/billing/invoice/history"]'),
  ).toBeHidden();
  await page.fill("[data-mokly-search]", "billing/invoice/arch");
  await expect(
    list.locator('a[data-entry-id="fixture/billing/invoice/archive/old"]'),
  ).toBeVisible();
});

test("breadcrumbs open a folder's page or reveal a folder without changing the view", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/fixture/billing/invoice/history/`);
  const crumbs = page.getByLabel("Catalogue location");
  await expect(crumbs).toHaveText("Fixture›Billing & Payments›Invoice");
  await crumbs.getByRole("link", { name: "Invoice" }).click();
  await expect(page).toHaveURL(/\/view\/fixture\/billing\/invoice\/$/);
  await expect(page.locator("#mb-main h2")).toHaveText("Invoice");

  await page.goto(`${server.url}/view/fixture/tools/setup/`);
  const tools = folder(page, "fixture/tools");
  await expect(tools).toHaveAttribute("open", "");
  await tools.locator(":scope > summary").click();
  await expect(tools).not.toHaveAttribute("open", "");
  await page
    .getByLabel("Catalogue location")
    .getByRole("button", { name: "Tools" })
    .click();
  await expect(tools).toHaveAttribute("open", "");
  await expect(tools.locator(":scope > summary")).toBeFocused();
  await expect(page).toHaveURL(/\/view\/fixture\/tools\/setup\/$/);
  await expect(page.locator("#mb-main h2")).toHaveText("Setup");
  await expect
    .poll(() => readDisclosureStorage(page))
    .toMatchObject({ "folder:specs:fixture/tools": true });

  await page.fill("[data-mokly-search]", "zzz");
  await expect(folder(page, "fixture")).toBeHidden();
  await page
    .getByLabel("Catalogue location")
    .getByRole("button", { name: "Fixture" })
    .click();
  await expect(page.locator("[data-mokly-search]")).toHaveValue("");
  await expect(folder(page, "fixture")).toBeVisible();
  await expect(
    folder(page, "fixture").locator(":scope > summary"),
  ).toBeFocused();
  await expect(page.locator("#mb-main h2")).toHaveText("Setup");
});

test("a narrow breadcrumb reveal opens the drawer at the folder", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(`${server.url}/view/fixture/tools/setup/`);
  const root = page.locator(".mbk[data-drawer]");
  await expect(root).toHaveAttribute("data-drawer", "closed");
  await expect(page.locator(".mbk-nav")).toBeHidden();
  await page
    .getByLabel("Catalogue location")
    .getByRole("button", { name: "Tools" })
    .click();
  await expect(root).toHaveAttribute("data-drawer", "open");
  await expect(page.locator(".mbk-nav")).toBeVisible();
  await expect(
    folder(page, "fixture/tools").locator(":scope > summary"),
  ).toBeFocused();
  await expect(page.locator("#mb-main h2")).toHaveText("Setup");
});

test("a saved list choice restores the contents label after mount", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "mokly:nav-disclosure:v4",
      JSON.stringify({
        "folder:specs:fixture/billing": true,
        "variants:fixture/billing/invoice": true,
      }),
    ),
  );
  await page.goto(`${server.url}/view/fixture/tools/setup/`);
  await expect(
    page.getByRole("button", { name: "Hide contents of Invoice" }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.locator('[data-nav-disclosure="variants:fixture/billing/invoice"]'),
  ).toBeVisible();
});

test("search through a folder's title shows its rows and keeps the query on navigation", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/fixture/guide/intro/`);
  await page.fill("[data-mokly-search]", "payments");
  for (const id of [
    "fixture/billing/invoice",
    "fixture/billing/invoice/overdue",
    "fixture/billing/invoice/history",
    "fixture/billing/invoice/archive/old",
  ])
    await expect(
      page.locator(`a[data-nav-row][data-entry-id="${id}"]`),
    ).toBeVisible();
  await expect(folder(page, "fixture/tools")).toBeHidden();
  await expect(folder(page, "fixture/guide")).toBeHidden();
  await page
    .locator('a[data-nav-row][data-entry-id="fixture/billing/invoice/history"]')
    .click();
  await expect(page).toHaveURL(/\/view\/fixture\/billing\/invoice\/history\/$/);
  await expect(page.locator("#mb-main h2")).toHaveText("History");
  await expect(page.locator("[data-mokly-search]")).toHaveValue("payments");
});
