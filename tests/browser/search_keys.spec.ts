/**
 * The search keys under the shell design contract: ⌘K and Ctrl+K move focus
 * to the catalogue search field from anywhere in the shell, and / does the
 * same while focus is not in a text field. A standalone shell hears them on
 * its whole document, and an embedded root only inside the root, so that the
 * host page keeps its own keys. Where the compact bar hides the field, the
 * keys open the compact search.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import { test } from "./browser_test.js";

import type {} from "./viewer_harness.js";

/** The focus glow's ring: a 4px spread without blur, before any other shadow. */
const GLOW = /^(?:rgba?|color)\([^)]*\) 0px 0px 0px 4px(?:,|$)/u;

async function shadow(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).boxShadow);
}

test("⌘K, Ctrl+K and / move focus from a catalogue row to the search field, which glows, and / in the field types itself", async ({
  page,
}) => {
  await page.goto("/view/example/screens/welcome/");
  const search = page.getByRole("searchbox", { name: "Search catalogue" });
  // The field around the input draws the glow; it has no role of its own.
  const field = page.locator(".mbk-search").filter({ has: search });
  const row = page
    .getByRole("navigation", { name: "Catalogue" })
    .getByRole("link", { name: "Getting started", exact: true });
  await expect(search).toBeVisible();
  expect(await shadow(field)).not.toMatch(GLOW);
  for (const key of ["Control+K", "Meta+K", "/"]) {
    await row.focus();
    await expect(row).toBeFocused();
    await page.keyboard.press(key);
    await expect(search, key).toBeFocused();
    // The key moves focus and types nothing into the field.
    await expect(search, key).toHaveValue("");
    await expect.poll(() => shadow(field), key).toMatch(GLOW);
  }
  // In the field, / is the field's own key.
  await page.keyboard.press("/");
  await expect(search).toHaveValue("/");
});

test.describe("an embedded root", () => {
  let fixture: Awaited<ReturnType<typeof viewerFixture>>;

  test.beforeAll(async () => {
    fixture = await viewerFixture();
  });

  test.afterAll(async () => {
    await fixture?.close();
  });

  async function startRoot(page: Page, width: number): Promise<Locator> {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(fixture.host.url);
    await page.waitForFunction(() => Boolean(window.viewerHarness));
    await page.evaluate(() =>
      window.viewerHarness.start("one", { responsive: true }),
    );
    await page.waitForFunction(() =>
      Boolean(window.viewerHarness.get("one").ref.current),
    );
    return page.locator("#one");
  }

  test("Ctrl+K and / inside the root move focus to its search field, and the host page keeps its keys", async ({
    page,
  }) => {
    const root = await startRoot(page, 1440);
    // A control of the host page itself, outside the viewer root.
    await page.evaluate(() => {
      const button = document.createElement("button");
      button.textContent = "Host action";
      document.body.prepend(button);
    });
    const search = root.getByRole("searchbox", { name: "Search catalogue" });
    const row = root
      .getByRole("navigation", { name: "Catalogue" })
      .getByRole("link", { name: "Action", exact: true });
    for (const key of ["Control+K", "/"]) {
      await row.focus();
      await page.keyboard.press(key);
      await expect(search, key).toBeFocused();
    }
    const host = page.getByRole("button", { name: "Host action" });
    for (const key of ["Control+K", "/"]) {
      await host.focus();
      await page.keyboard.press(key);
      await expect(host, key).toBeFocused();
    }
  });

  test("Ctrl+K opens the compact search of a narrow root and focuses its field", async ({
    page,
  }) => {
    const root = await startRoot(page, 390);
    const toggle = root.getByRole("button", { name: "Search catalogue" });
    const search = root.getByRole("searchbox", { name: "Search catalogue" });
    await expect(toggle).toBeVisible();
    await expect(search).toBeHidden();
    await root.getByRole("link", { name: "Mokly" }).focus();
    await page.keyboard.press("Control+K");
    await expect(search).toBeFocused();
    // The open compact search shows Close search in place of its toggle.
    await expect(
      root.getByRole("button", { name: "Close search" }),
    ).toBeVisible();
    await expect(toggle).toBeHidden();
    // Escape closes it and returns focus to its toggle.
    await page.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
    await expect(search).toBeHidden();
  });
});
