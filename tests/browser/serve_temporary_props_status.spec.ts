/**
 * Temporary props in Serve under the component controls contract: a
 * component that is unchanged against the base commit stays Unmodified while
 * a temporary edit shows, after Reset, and on an unchanged saved variant. The
 * edit reaches no URL, Changes count, local storage, source, Git status, or
 * publication, and a reload shows the saved props.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { expect, type Page } from "@playwright/test";

import { git } from "../helpers/static_changes.js";

import { showProps } from "./live_props.js";
import { test } from "./serve_comparison_test.js";
import { canvasFrame, chooseVariant } from "./workspace_actions.js";

/** The tag of a row of the variant set, in its Light frame on the canvas. */
function tagOf(page: Page, row: string) {
  return page
    .frameLocator(`${canvasFrame("desktop")}[data-workspace-variant="${row}"]`)
    .locator(".tag");
}

test("desktop: temporary props and Reset keep an unchanged component Unmodified", async ({
  page,
  changes,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const source = path.join(changes.root, "specs/components/tag.component.html");
  const saved = await fs.readFile(source, "utf8");
  const status = page.locator("[data-workspace-status]");
  const count = page.locator(
    'button[data-filter="changed"] .mbk-nav-filter-count',
  );
  await page.goto(`/view/${changes.paths.quietParent}/?viewport=desktop`);
  await expect(status).toHaveText("Unmodified");
  const changed = (await count.textContent())!;
  const address = page.url();
  const { revision } = await changes.index();
  const tree = await git(changes.root, "status", "--porcelain");
  const props = await showProps(page);
  const label = props.getByRole("textbox", { name: "label" });
  const tag = tagOf(page, changes.paths.quietParent);
  await expect(label).toBeEditable();
  await expect(tag).toHaveText("Tag content");

  await label.fill("Temporary tag");
  await expect(tag).toHaveText("Temporary tag");
  await expect(status).toHaveText("Unmodified");
  await expect(count).toHaveText(changed);
  await expect(page).toHaveURL(address);

  await props.getByRole("button", { name: "Reset to Tag" }).click();
  await expect(tag).toHaveText("Tag content");
  await expect(label).toHaveValue("Tag content");
  await expect(status).toHaveText("Unmodified");

  await chooseVariant(page, "Plain");
  await expect(tagOf(page, `${changes.paths.quietParent}/plain`)).toHaveText(
    "Plain tag",
  );
  await expect(status).toHaveText("Unmodified");
  await expect(count).toHaveText(changed);
  expect(await fs.readFile(source, "utf8")).toBe(saved);
  expect(await git(changes.root, "status", "--porcelain")).toBe(tree);
  expect((await changes.index()).revision).toBe(revision);
});

/** Every local storage entry of the page, by key. */
function storedEntries(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate(() =>
    Object.fromEntries(
      Array.from({ length: localStorage.length }, (_, index) => {
        const key = localStorage.key(index)!;
        return [key, localStorage.getItem(key)];
      }),
    ),
  );
}

test("a temporary prop edit stays out of local storage, and a reload shows the saved props", async ({
  page,
  changes,
}) => {
  await page.goto(`/view/${changes.paths.quietParent}/?viewport=desktop`);
  const label = (await showProps(page)).getByRole("textbox", {
    name: "label",
  });
  const tag = tagOf(page, changes.paths.quietParent);
  await expect(label).toBeEditable();
  const stored = await storedEntries(page);

  await label.fill("Temporary tag");
  await expect(tag).toHaveText("Temporary tag");
  expect(await storedEntries(page)).toEqual(stored);

  await page.reload();
  await expect(tag).toHaveText("Tag content");
  await expect(
    (await showProps(page)).getByRole("textbox", { name: "label" }),
  ).toHaveValue("Tag content");
  expect(JSON.stringify(await storedEntries(page))).not.toContain(
    "Temporary tag",
  );
});
