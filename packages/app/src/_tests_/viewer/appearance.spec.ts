import { expect, open, test } from "../harness";

import { publishedViewerReady, publishedProject } from "./support";

/**
 * The package draws its own top bar, rail and stage chrome around the cloud
 * controls in its slots, so its interface takes the scheme the app chrome is
 * drawn in. The previews keep the scheme the address chose: the two are
 * independent inputs, and only the first follows the reader's system.
 */
test("the package interface follows the app's scheme and not the preview's", async ({
  page,
}) => {
  const { publicationPath: path } = await publishedProject(page, "appearance");
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page, `${path}?catalogueScreen=start&scheme=light`);
  await publishedViewerReady(page);
  const root = page.locator("html");
  const shell = page.locator("[data-mokly-shell]");
  await expect(root).toHaveAttribute("data-color-scheme", "dark");
  await expect(shell).toHaveAttribute("data-mokly-theme", "dark");
  await expect(shell).toHaveAttribute("data-mokly-color-scheme", "light");

  // A system change reaches both chromes together and leaves the preview on
  // the scheme the address named.
  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveAttribute("data-color-scheme", "light");
  await expect(shell).toHaveAttribute("data-mokly-theme", "light");
  await expect(shell).toHaveAttribute("data-mokly-color-scheme", "light");
  await expect(
    page.getByRole("heading", { level: 2, name: "Start" }),
  ).toBeVisible();
});
