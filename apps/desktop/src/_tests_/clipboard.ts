import { expect } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import { screenshot } from "./shell";

/** Exercise the product action and read the native clipboard outside the renderer. */
export async function expectShareClipboard(
  electron: ElectronApplication,
  page: Page,
): Promise<void> {
  await electron.evaluate(async ({ clipboard }) => {
    await clipboard.writeText("before desktop copy");
  });
  await page.getByTestId("viewer-share").click();
  // The link field draws in its waiting form, empty, while the link is
  // prepared, so wait for the link before reading it once.
  const field = page.getByLabel("Publication link");
  await expect(field).toHaveValue(/^https?:\/\//);
  const link = await field.inputValue();
  expect(link).toMatch(/^https?:\/\//);
  await page.getByTestId("share-copy").click();
  await expect(
    page
      .getByRole("region", { name: "Notifications" })
      .getByText("Link copied", { exact: true }),
  ).toBeVisible();
  expect(
    await electron.evaluate(
      async ({ clipboard }) => await clipboard.readText(),
    ),
  ).toBe(link);
  await screenshot(page, "share-copy");
  await page.getByRole("button", { name: "Close", exact: true }).click();
}
