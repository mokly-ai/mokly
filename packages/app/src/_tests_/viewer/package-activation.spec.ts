import { expect, open, test } from "../harness";

import { publishedViewerReady, publishedProject } from "./support";

/*
 * A press on a settled package slot activates its control once. Each step
 * opens the publication again, so each counts its own clicks.
 */
test("a settled package pointer or Space press activates its control once", async ({
  page,
}) => {
  const { publicationPath } = await publishedProject(page, "settled-press");

  await test.step("a settled package pointer press activates History once", async () => {
    await open(page, publicationPath);
    await publishedViewerReady(page);
    await page.evaluate(() => {
      document.documentElement.dataset.viewerNativeClicks = "0";
      document.addEventListener(
        "click",
        (event) => {
          if (
            event.target instanceof Element &&
            event.target.closest('[data-testid="viewer-history"]')
          ) {
            const value = Number(
              document.documentElement.dataset.viewerNativeClicks ?? "0",
            );
            document.documentElement.dataset.viewerNativeClicks = String(
              value + 1,
            );
          }
        },
        true,
      );
    });
    const historyLength = await page.evaluate(() => window.history.length);
    const trigger = page.getByTestId("viewer-history");
    const box = await trigger.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(
      (box?.x ?? 0) + (box?.width ?? 0) / 2,
      (box?.y ?? 0) + (box?.height ?? 0) / 2,
    );
    await page.mouse.down();
    await page.mouse.up();

    expect(
      await page.evaluate(() =>
        Number(document.documentElement.dataset.viewerNativeClicks ?? "0"),
      ),
    ).toBe(1);
    await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
    await expect(page.getByTestId("viewer-panel-history")).toHaveCount(1);
    await expect(page).toHaveURL(/panel=history/);
    expect(await page.evaluate(() => window.history.length)).toBe(
      historyLength + 1,
    );
  });

  await test.step("a settled package Space press opens the account menu once", async () => {
    await open(page, publicationPath);
    await publishedViewerReady(page);
    await page.evaluate(() => {
      document.documentElement.dataset.viewerNativeClicks = "0";
      document.addEventListener(
        "click",
        (event) => {
          if (
            event.target instanceof Element &&
            event.target.closest('[data-testid="viewer-account"]')
          ) {
            const value = Number(
              document.documentElement.dataset.viewerNativeClicks ?? "0",
            );
            document.documentElement.dataset.viewerNativeClicks = String(
              value + 1,
            );
          }
        },
        true,
      );
    });
    const historyLength = await page.evaluate(() => window.history.length);
    const trigger = page.getByTestId("viewer-account");
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await page.keyboard.down("Space");
    await page.keyboard.up("Space");

    expect(
      await page.evaluate(() =>
        Number(document.documentElement.dataset.viewerNativeClicks ?? "0"),
      ),
    ).toBe(1);
    const menu = page.getByRole("menu", { name: "Account" });
    await expect(menu).toBeVisible();
    await expect(menu).toHaveCount(1);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    // A menu is not an overlay of the address: opening it adds no entry.
    await expect(page).not.toHaveURL(/settings=|panel=/);
    expect(await page.evaluate(() => window.history.length)).toBe(
      historyLength,
    );
  });
});
