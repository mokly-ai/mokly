import type { Page } from "@playwright/test";

import { expect, open } from "../harness";

// The reader's own way into the dialog is a step inside the running
// application, not a page load, and only that path exercises the router's
// history. A narrow window widened is the one such path that exists before the
// viewer's chrome carries a settings control.
export async function openDialogInApp(page: Page, pane: string): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "/settings");
  await page
    .locator(".content-list-row")
    // Exact, because one pane's title can sit inside another's: Account and
    // GitHub accounts.
    .filter({ has: page.getByText(pane, { exact: true }) })
    .getByRole("link")
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: pane, exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  // The durable route draws the dialog's wait until it hands over to the
  // dialog by replacing its address, and the dialog opens while its scope
  // still loads. A key pressed before the address carries the dialog lands on
  // the route's wait, ahead of the hand-over.
  await expect(page).toHaveURL((url) => url.searchParams.has("settings"));
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 1 }),
  ).toHaveText(pane);
  // The dialog is drawn a step before it takes the keyboard: it moves focus
  // onto the pane the reader chose and starts to take Escape together, once
  // it is on screen. A key pressed between the two reaches no dialog.
  await expect(
    page.getByRole("dialog").getByRole("link", { name: pane, exact: true }),
  ).toBeFocused();
}
