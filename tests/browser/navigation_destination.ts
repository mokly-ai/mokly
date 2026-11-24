import { expect, type Page } from "@playwright/test";

/**
 * Expect the shell on the nested fixture's Details destination. Its address
 * also names the kept viewport, unless that is Both.
 */
export async function expectDestination(
  page: Page,
  viewport?: "desktop" | "mobile",
): Promise<void> {
  const kept = viewport ? `&viewport=${viewport}` : "";
  await expect(page).toHaveURL(
    new RegExp(`/view/fixture/nested/details/\\?fragment=section${kept}$`),
  );
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
}
