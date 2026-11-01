/**
 * Same-document history of the client-rendered shell over Serve of the
 * example, under the shell delivery contract: fragment history keeps the
 * view and the focus, saved-variant routes keep their own entries, Back
 * during a pending detail keeps the previous route, and history reads a
 * detail that it did not keep under the deployment fence.
 */

import { expect, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import {
  DETAILS,
  heading,
  holdReads,
  loadsOf,
  MEMBERS,
  navLink,
  openFolder,
  readsOf,
  rewritten,
  route,
  titles,
  WELCOME,
} from "./shell_route_fixture.js";

const ACTION = "example/components/action";

/** Follow the skip link from the keyboard. */
async function skipToContent(page: Page) {
  await page.getByRole("link", { name: "Skip to content" }).focus();
  await page.keyboard.press("Enter");
}

test("the skip link adds fragment history without reading the route again", async ({
  page,
  request,
}) => {
  const names = await titles(request);
  await page.goto(route(WELCOME));
  await expect(page.locator("#mb-main iframe")).toHaveCount(2);
  const reads = readsOf(page);
  const loads = loadsOf(page);
  const main = page.locator("#mb-main");
  await skipToContent(page);
  await expect(page).toHaveURL(new RegExp(`${route(WELCOME)}#mb-main$`));
  await expect(main).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${route(WELCOME)}$`));
  await expect(main).toBeFocused();
  await expect(heading(page)).toHaveText(names.get(WELCOME)!);
  await expect(page.locator("#mb-main iframe")).toHaveCount(2);
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`${route(WELCOME)}#mb-main$`));
  await expect(main).toBeFocused();
  expect(reads).toEqual([]);
  expect(loads.count).toBe(0);
});

test("saved-variant routes and fragment history keep separate entries", async ({
  page,
}) => {
  await page.goto(route(ACTION));
  const variants = page.getByRole("navigation", { name: "Saved variants" });
  const base = variants.getByRole("link", { name: "Action", exact: true });
  const disabled = variants.getByRole("link", {
    name: "Disabled",
    exact: true,
  });
  await expect(base).toHaveAttribute("aria-current", "page");
  await expect(page.locator("#mb-main iframe").first()).toBeVisible();
  const reads = readsOf(page);
  const loads = loadsOf(page);
  await disabled.click();
  await expect(page).toHaveURL(new RegExp(`${route(`${ACTION}/disabled`)}$`));
  await expect(disabled).toHaveAttribute("aria-current", "page");
  await skipToContent(page);
  await expect(page).toHaveURL(
    new RegExp(`${route(`${ACTION}/disabled`)}#mb-main$`),
  );
  await expect(page.locator("#mb-main")).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${route(`${ACTION}/disabled`)}$`));
  await expect(disabled).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${route(ACTION)}$`));
  await expect(base).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`${route(`${ACTION}/disabled`)}$`));
  await expect(disabled).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(page).toHaveURL(
    new RegExp(`${route(`${ACTION}/disabled`)}#mb-main$`),
  );
  await expect(disabled).toHaveAttribute("aria-current", "page");
  expect(reads).toEqual([`/mokly-viewer/entries/${ACTION}/disabled.json`]);
  expect(loads.count).toBe(0);
});

test("Back during a pending navigation keeps the previous route, and Forward loads it again", async ({
  page,
  request,
}) => {
  const names = await titles(request);
  await page.goto(route(WELCOME));
  await expect(heading(page)).toHaveText(names.get(WELCOME)!);
  const loads = loadsOf(page);
  const reads = readsOf(page);
  const detail = `/mokly-viewer/entries/${DETAILS}.json`;
  const release = await holdReads(page, detail);
  await navLink(page, DETAILS).click();
  await expect(heading(page)).toHaveText(names.get(DETAILS)!);
  await expect(page.getByText("Loading preview…")).toBeVisible();
  const aborted = page.waitForEvent(
    "requestfailed",
    (failed) => new URL(failed.url()).pathname === detail,
  );
  await page.goBack();
  await aborted;
  await expect(page).toHaveURL(new RegExp(`${route(WELCOME)}$`));
  await expect(heading(page)).toHaveText(names.get(WELCOME)!);
  await expect(page.locator("#mb-main iframe")).toHaveCount(2);
  release();
  await page.unrouteAll({ behavior: "wait" });
  await expect(page).toHaveURL(new RegExp(`${route(WELCOME)}$`));
  await expect(heading(page)).toHaveText(names.get(WELCOME)!);
  await expect(page.getByText("Loading preview…")).toHaveCount(0);
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`${route(DETAILS)}$`));
  await expect(heading(page)).toHaveText(names.get(DETAILS)!);
  await expect(page.locator("#mb-main iframe")).toHaveCount(2);
  expect(reads).toEqual([detail, detail]);
  expect(loads.count).toBe(0);
});

for (const direction of ["Back", "Forward"] as const)
  test(`${direction} to a route without a kept detail reads it, and another deployment loads the URL again`, async ({
    page,
    request,
  }) => {
    const names = await titles(request);
    await page.goto(route(WELCOME));
    await expect(heading(page)).toHaveText(names.get(WELCOME)!);
    const detail = `/mokly-viewer/entries/${DETAILS}.json`;
    const replaced = rewritten((body) => ({
      ...body,
      detailId: "f".repeat(64),
    }));
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    // The first read waits until the shell gives it up, the second answers
    // for another deployment, and the read after the page load passes.
    let reads = 0;
    await page.route(`**${detail}`, async (held) => {
      reads += 1;
      if (reads === 1) {
        await released;
        await held.continue().catch(() => undefined);
      } else if (reads === 2) await replaced(held);
      else await held.continue();
    });
    await navLink(page, DETAILS).click();
    await expect(page.getByText("Loading preview…")).toBeVisible();
    const aborted = page.waitForEvent(
      "requestfailed",
      (failed) => new URL(failed.url()).pathname === detail,
    );
    if (direction === "Back") {
      await openFolder(page, "example/team");
      await navLink(page, MEMBERS).click();
      await expect(heading(page)).toHaveText(names.get(MEMBERS)!);
    } else {
      await page.goBack();
      await expect(heading(page)).toHaveText(names.get(WELCOME)!);
    }
    await aborted;
    release();
    await expect(page.locator("#mb-main iframe")).toHaveCount(2);
    const loads = loadsOf(page);
    await (direction === "Back" ? page.goBack() : page.goForward());
    await expect.poll(() => loads.count).toBe(1);
    await expect(page).toHaveURL(new RegExp(`${route(DETAILS)}$`));
    await expect(heading(page)).toHaveText(names.get(DETAILS)!);
    await expect(page.locator("#mb-main iframe")).toHaveCount(2);
    expect(reads).toBe(3);
    await page.unrouteAll({ behavior: "wait" });
  });
