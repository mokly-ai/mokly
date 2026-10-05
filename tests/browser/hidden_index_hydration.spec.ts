import { expect, test } from "@playwright/test";

import { readDisclosureStorage } from "./disclosure_storage.js";
import {
  buildDevelopmentBundle,
  captureBrowserErrors,
  expectCleanHydration,
  installDevelopmentBundle,
} from "./react_shell_hydration_helpers.js";
import { startWatchedServe, type WatchedServe } from "./watched_serve.js";

const source = `import { defineComponent, defineFolder, defineScreen } from "@mokly/mokly";
import React from "react";
const meta = { dependencies: ["notes.md"], relatedDocs: ["notes.md"] };
const shot = (id: string) => ({ ...meta, desktop: <main id={id}>{id}</main>, mobile: <main id={id + "-mobile"}>{id}</main> });
const part = (path: string, title: string, slug?: string) => defineComponent({ dependencies: ["notes.md"], relatedDocs: [], path, ...(slug ? { slug } : {}), title, description: title, propSchema: { kind: "object", properties: {} }, render: () => <span>{title}</span>, variants: [{ slug: slug ? "sealed" : "default", title: slug ? "Kit sealed" : "Default", props: {} }] });
const kit = part("fx/kit", "Kit", "index");
const badge = part("fx/kit/badge", "Badge");
export const vault = defineScreen({ ...shot("vault"), path: "fx/vault", slug: "index", title: "Vault", description: "Vault", variants: [{ ...shot("sealed"), slug: "sealed", title: "Sealed", description: "Sealed" }] });
export const item = defineScreen({ ...shot("item"), path: "fx/vault/item", title: "Item", description: "Item" });
export const open = defineScreen({ ...shot("open"), path: "fx/open", title: "Open", description: "Open" });
export const folders = [defineFolder({ path: "fx/vault", hidden: true }), defineFolder({ path: "fx/kit", hidden: true })];
export const components = [...kit.entries, ...badge.entries];
`;

let server: WatchedServe;
let developmentBundle: string;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  developmentBundle = await buildDevelopmentBundle();
  server = await startWatchedServe(source);
});

test.afterAll(async () => {
  if (server) await server.stop();
});

for (const [kind, member, variant, list] of [
  ["screen", "fx/vault/item", "fx/vault/sealed", "variants:fx/vault"],
  ["component", "fx/kit/badge", "fx/kit/sealed", "variants:fx/kit"],
] as const) {
  test(`a hidden folder's own ${kind} keeps its list hidden through hydration`, async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await installDevelopmentBundle(page, developmentBundle);
    await page.goto(`${server.url}/view/${member}/`);
    await expectCleanHydration(page, errors, `loading ${member}`);
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
    await expectCleanHydration(page, errors, "with the list saved open");
    await expect(page.locator(`a[data-entry-id="${variant}"]`)).toBeHidden();
    await expect(page.locator(`[data-nav-disclosure="${list}"]`)).toBeHidden();
    await expect(
      page.locator('a[data-entry-id="fx/open"][data-nav-row]'),
    ).toBeVisible();
  });
}
