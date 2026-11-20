import type { Page } from "@playwright/test";

import { expect } from "../harness";

/** Make a token through the create modal, leaving its secret on screen. */
export async function makeToken(page: Page, name: string): Promise<void> {
  await page.getByTestId("new-token").click();
  await page.getByLabel("Token name").fill(name);
  await page.getByTestId("create-token").click();
  await expect(page.getByTestId("copy-token")).toBeVisible();
}

/** One token row's own three-dot trigger, named for the row. */
export function rowMenu(page: Page, name: string) {
  return page.getByRole("button", { name: "Actions for " + name });
}

/** Choose Revoke from one token row's own three-dot menu. */
export async function chooseRevoke(page: Page, name: string): Promise<void> {
  await rowMenu(page, name).click();
  await page.getByRole("menuitem", { name: "Revoke", exact: true }).click();
}
