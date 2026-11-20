import type { Page } from "@playwright/test";

import { expect } from "../harness";

/** Every pane opens, shows its own scope and acts against the real API. */

/** The manage panel, whoever it is for. */
export function panel(page: Page) {
  return page.getByRole("region", { name: /^Manage / });
}

/**
 * Open the manage panel for one person, named by their address, and say whose
 * panel it is: a test that opens a detail panel asserts which one it opened,
 * rather than trusting the order a list happens to arrive in.
 */
export async function manage(page: Page, who: string): Promise<void> {
  await page
    .locator(".fo-member-row")
    .filter({ hasText: who })
    .getByRole("button", { name: "Manage" })
    .click();
  await expect(panel(page)).toHaveAccessibleName("Manage " + who);
  await expect(page.getByTestId("remove-member")).toBeVisible();
}

/** The panel's own role control, which is not the invite form's. */
export function panelRole(page: Page, name: string) {
  return panel(page).getByRole("radio", { name });
}
