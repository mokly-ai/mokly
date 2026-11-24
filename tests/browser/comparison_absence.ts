/**
 * The check that an entry shows no comparison at all, such as a removed
 * entry's previous version: the right panel renders no comparison band, not
 * even hidden in a tab that is not selected, and the canvas holds no
 * comparison state and no version's frame.
 */

import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Expect `scope`, a page or a viewer's root, to render no comparison band,
 * no comparison state and no pane frame. Call it once the routed entry's
 * detail settled, such as after `awaitRoutedDetail`.
 */
export async function expectNoComparison(scope: Page | Locator): Promise<void> {
  await expect(
    scope.getByRole("group", { name: "Comparison mode", includeHidden: true }),
  ).toHaveCount(0);
  await expect(scope.locator("[data-diff-refresh]")).toHaveCount(0);
  await expect(scope.locator("[data-diff-stage]")).toHaveCount(0);
  await expect(
    scope.locator("iframe[data-mokly-comparison-frame]"),
  ).toHaveCount(0);
}
