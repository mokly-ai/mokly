/** A moved component's variants, run against one host. */

import { expect, test, type Page } from "@playwright/test";

import type {
  MovedChangesHost,
  MovedHostKind,
} from "./moved_changes_fixture.js";
import { ACTION, consoleErrors, row, showDetails } from "./moved_rows.js";

const BAR = ["Primary", "Ghost", "Iconic", "Secondary · Removed"];

function savedVariants(page: Page) {
  return page.getByRole("navigation", { name: "Saved variants" });
}

async function expectBar(page: Page, status: string): Promise<void> {
  await expect(page.locator("[data-workspace-variant-status]")).toHaveText(
    status,
  );
  await expect(savedVariants(page).getByRole("link")).toHaveText(BAR);
}

/** Register the moved component cases for the host `current` returns. */
export function movedComponentCases(
  kind: MovedHostKind,
  current: () => MovedChangesHost,
): void {
  test("a moved component's variants read their own changes, never the move", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const errors = consoleErrors(page);
    for (const [slug, status] of [
      ["primary", "Primary · Unmodified"],
      ["ghost", "Ghost · Changed"],
      ["iconic", "Iconic · Changed"],
    ] as const) {
      await current().open(page, `${ACTION}/${slug}`);
      await expectBar(page, status);
    }
    expect(errors).toEqual([]);
  });

  test("a variant deleted during its parent's move opens with that parent's workspace", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const errors = consoleErrors(page);
    await current().open(page, "components/action/secondary");
    await expectBar(page, "Secondary · Removed");
    await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
    await page.getByRole("tab", { name: "Props", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Inspector", exact: true }),
    ).toContainText("Go back");
    expect(errors).toEqual([]);
  });

  if (kind !== "viewer")
    test("a moved variant keeps the nested inputs it changed in Details", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await current().open(page, `${ACTION}/iconic`);
      await showDetails(page);
      const evidence = page.locator("[data-workspace-evidence]");
      for (const viewport of ["mobile", "desktop"])
        await expect(
          evidence.getByRole("heading", {
            name: `Icon · glyph · ${viewport} · light`,
          }),
        ).toBeVisible();
      await expect(evidence.locator("pre")).toHaveText([
        /arrow/u,
        /chevron/u,
        /arrow/u,
        /chevron/u,
      ]);
    });

  if (kind !== "viewer")
    test("a moved parent lists its removed variant from the first paint after navigation", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      let release = () => {};
      let fetching = () => {};
      const held = new Promise<void>((resolve) => (release = resolve));
      const fetched = new Promise<void>((resolve) => (fetching = resolve));
      await page.route(`**/view/${ACTION}/`, async (route) => {
        if (route.request().resourceType() === "fetch") {
          fetching();
          await held;
        }
        await route.continue();
      });
      await current().open(page, "ui/icon");
      await row(page, ACTION).click();
      await expect(page).toHaveURL(new RegExp(`/view/${ACTION}/$`, "u"));
      await fetched;
      await expect(savedVariants(page).getByRole("link")).toHaveText(BAR);
      release();
      await expect(page.locator("[data-workspace-variant-status]")).toHaveText(
        "Primary · Unmodified",
      );
      await expect(savedVariants(page).getByRole("link")).toHaveText(BAR);
    });
}
