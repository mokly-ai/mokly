/** A moved component's variants, run against one host. */

import { expect, type Page } from "@playwright/test";

import { movedFixturePaths as moves } from "../helpers/moved_fixture_sources.js";

import type { test as baseTest } from "./browser_test.js";
import { expectHostPath } from "./entry_hosts.js";
import { ACTION, row, type MovedHost } from "./moved_rows.js";
import { openInspectFold, revealInPanel } from "./workspace_actions.js";

/** Inspect's Variants of the moved Action: its own example, then its variants. */
const ROWS = ["Action", "Primary", "Ghost", "Iconic", "Secondary"];

function variants(page: Page) {
  return page.locator(
    '[data-inspect-section="variants"] [data-inspect-variant]',
  );
}

/**
 * Expect the shown entry's status in Inspect's head, Inspect's Variants, and
 * the checked row of the routed variant, whose frame is selected.
 */
async function expectVariants(
  page: Page,
  status: string,
  checked?: string,
): Promise<void> {
  await expect(page.locator("[data-workspace-status]")).toHaveText(status);
  await expect(variants(page)).toHaveText(ROWS);
  if (checked !== undefined)
    await expect(
      page.locator('[data-inspect-section="variants"] [data-checked]'),
    ).toHaveText(checked);
}

/** Register the moved component cases on `host`, which `test` serves. */
export function registerMovedComponentCases(
  test: typeof baseTest,
  host: MovedHost,
): void {
  test("a moved component's variants read their own changes, never the move", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const [entry, status, checked] of [
      [moves.unchangedMovedVariant, "Unmodified", "Primary"],
      [moves.metadataMovedVariant, "Changed", "Ghost"],
      [moves.nestedMovedVariant, "Changed", "Iconic"],
    ] as const) {
      await host.open(page, entry);
      await expectVariants(page, status, checked);
    }
  });

  test("a variant deleted during its parent's move opens with that parent's workspace", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await host.open(page, moves.removedActionVariant);
    await expectVariants(page, "Removed", "Secondary");
    // Props shows the removed variant's saved props.
    await expect(await openInspectFold(page, "props")).toContainText("Go back");
  });

  test("a moved variant keeps the nested inputs it changed in its comparison details", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await host.open(page, moves.nestedMovedVariant);
    const evidence = page.locator("[data-workspace-evidence]");
    await revealInPanel(page, evidence);
    // The fixture renders both schemes, so each view names its own input.
    for (const viewport of ["mobile", "desktop"])
      for (const scheme of ["light", "dark"])
        await expect(
          evidence.getByRole("heading", {
            name: `Icon · glyph · ${viewport} · ${scheme}`,
          }),
        ).toBeVisible();
    await expect(evidence.locator("pre")).toHaveText(
      Array.from({ length: 4 }, () => [/arrow/u, /chevron/u]).flat(),
    );
  });

  test("a moved parent lists its removed variant from the first paint after navigation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    let release = () => {};
    let fetching = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    const fetched = new Promise<void>((resolve) => (fetching = resolve));
    await page.route(
      `**/mokly-viewer/entries/${ACTION}.json`,
      async (route) => {
        fetching();
        await held;
        await route.continue();
      },
    );
    await host.open(page, moves.moveIcon);
    const opened = new URL(page.url());
    await page
      .locator(
        '[data-nav-disclosure="folder:components:branch/moves/current"] > summary',
      )
      .click();
    await row(page, ACTION).click();
    await expectHostPath(page, host, ACTION);
    // The row adds no query or hash to the address that the host opened.
    const routed = new URL(page.url());
    expect([routed.search, routed.hash]).toEqual([opened.search, opened.hash]);
    await fetched;
    await expect(variants(page)).toHaveText(ROWS);
    release();
    await expectVariants(page, "Unmodified");
  });
}
