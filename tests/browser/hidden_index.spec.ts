import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { serveCatalogue } from "./catalogue_fixture.js";
import { readDisclosureStorage } from "./disclosure_storage.js";
let server: Awaited<ReturnType<typeof serveCatalogue>>;
test.beforeAll(async () => {
  server = await serveCatalogue({
    "specs/index.mockup.tsx": `
import React from "react";
import {defineComponent, defineScreen, defineFolder} from "@mokly/mokly";
const meta = {relatedDocs: [], description: "Hidden folders"};
const shot = (path, title, extra = {}) => defineScreen({...meta, path, title, props: {}, render: () => <main>{title}</main>, ...extra});
const part = (path, title, extra = {}) => defineComponent({...meta, path, title, propSchema: {type: "object", properties: {}, additionalProperties: false}, props: {}, render: () => <span>{title}</span>, ...extra});
export const kit = part("fx/kit", "Kit", {slug: "index", variants: [{slug: "sealed", title: "Kit sealed", props: {}}]});
export const badge = part("fx/kit/badge", "Badge");
export const vault = shot("fx/vault", "Vault", {slug: "index", variants: [{slug: "sealed", title: "Sealed", props: {}}]});
export const item = shot("fx/vault/item", "Item");
export const open = shot("fx/open", "Open");
export const hiddenVault = defineFolder({path: "fx/vault", hidden: true});
export const hiddenKit = defineFolder({path: "fx/kit", hidden: true});
`,
  });
});
test.afterAll(async () => server?.close());
for (const [kind, member, variant, list] of [
  ["screen", "fx/vault/item", "fx/vault/sealed", "variants:fx/vault"],
  ["component", "fx/kit/badge", "fx/kit/sealed", "variants:fx/kit"],
] as const) {
  test(`a hidden folder's own ${kind} keeps its list hidden after mount and reload`, async ({
    page,
  }) => {
    await page.goto(`${server.url}/view/${member}/`);
    await expect(page.locator("#mb-main h2")).toBeVisible();
    await expect
      .poll(() => readDisclosureStorage(page))
      .toMatchObject({ [list]: true });
    await expect(page.locator(`[data-nav-disclosure="${list}"]`)).toBeHidden();
    await page.locator('a[data-entry-id="fx/open"][data-nav-row]').click();
    await expect(page).toHaveURL(/\/view\/fx\/open\/$/);
    await expect(page.locator(`a[data-entry-id="${variant}"]`)).toBeHidden();
    await expect
      .poll(() => readDisclosureStorage(page))
      .toMatchObject({ [list]: true });
    await page.reload();
    await expect(page.locator("#mb-main h2")).toHaveText("Open");
    await expect(page.locator(`a[data-entry-id="${variant}"]`)).toBeHidden();
    await expect(page.locator(`[data-nav-disclosure="${list}"]`)).toBeHidden();
    await expect(
      page.locator('a[data-entry-id="fx/open"][data-nav-row]'),
    ).toBeVisible();
  });
}
