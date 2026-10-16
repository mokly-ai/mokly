import { expect, type Page } from "@playwright/test";

export async function expectDestination(page: Page): Promise<void> {
  await expect(page).toHaveURL(
    /\/view\/fixture\/nested\/details\/\?fragment=section$/,
  );
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
}
