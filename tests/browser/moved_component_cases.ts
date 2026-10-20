/** A moved component's variants, run against one host. */

import { expect, type Page } from "@playwright/test";

import { movedFixturePaths as moves } from "../helpers/moved_fixture_sources.js";

import type { test as baseTest } from "./browser_test.js";
import { expectHostPath } from "./entry_hosts.js";
import { ACTION, row, showDetails, type MovedHost } from "./moved_rows.js";

/** The saved-variant bar of the moved Action: its parent, then its variants. */
const BAR = ["Action", "Primary", "Ghost", "Iconic", "Secondary · Removed"];

function savedVariants(page: Page) {
  return page.getByRole("navigation", { name: "Saved variants" });
}

async function expectBar(page: Page, status: string): Promise<void> {
  await expect(page.locator("[data-workspace-variant-status]")).toHaveText(
    status,
  );
  await expect(savedVariants(page).getByRole("link")).toHaveText(BAR);
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
    for (const [entry, status] of [
      [moves.unchangedMovedVariant, "Primary · Unmodified"],
      [moves.metadataMovedVariant, "Ghost · Changed"],
      [moves.nestedMovedVariant, "Iconic · Changed"],
    ] as const) {
      await host.open(page, entry);
      await expectBar(page, status);
    }
  });

  test("a variant deleted during its parent's move opens with that parent's workspace", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await host.open(page, moves.removedActionVariant);
    await expectBar(page, "Secondary · Removed");
    await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
    await page.getByRole("tab", { name: "Props", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Inspector", exact: true }),
    ).toContainText("Go back");
  });

  test("a moved variant keeps the nested inputs it changed in Details", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await host.open(page, moves.nestedMovedVariant);
    await showDetails(page);
    const evidence = page.locator("[data-workspace-evidence]");
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
    await page
      .locator(
        '[data-nav-disclosure="folder:components:branch/moves/current"] > summary',
      )
      .click();
    await row(page, ACTION).click();
    await expectHostPath(page, host, ACTION);
    await fetched;
    await expect(savedVariants(page).getByRole("link")).toHaveText(BAR);
    release();
    await expect(page.locator("[data-workspace-variant-status]")).toHaveText(
      "Action · Unmodified",
    );
    await expect(savedVariants(page).getByRole("link")).toHaveText(BAR);
  });
}
