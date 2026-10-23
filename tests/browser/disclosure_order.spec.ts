import { expect } from "@playwright/test";

import { readDisclosureStorage } from "./disclosure_storage.js";
import { test } from "./watch_fixture.js";

for (const [key, activation] of [
  ["folder:specs:fixture/screens", "click"],
  ["section:specs", "Enter"],
] as const) {
  test(`${key}: search follows activation while the close toggle is pending`, async ({
    page,
    watched,
  }) => {
    await page.addInitScript((disclosure) => {
      let armed = false;
      let held: HTMLDetailsElement | undefined;
      document.addEventListener("hold-disclosure-toggle", () => {
        armed = true;
      });
      document.addEventListener(
        "toggle",
        (event) => {
          if (
            armed &&
            event.target instanceof HTMLDetailsElement &&
            event.target.dataset["navDisclosure"] === disclosure &&
            !event.target.open
          ) {
            held = event.target;
            held.dataset["testToggleHeld"] = "true";
            event.stopImmediatePropagation();
          }
        },
        true,
      );
      document.addEventListener("release-disclosure-toggle", () => {
        armed = false;
        held?.dispatchEvent(new Event("toggle"));
        held = undefined;
      });
    }, key);
    await page.goto(`${watched.url}/view/fixture/screens/home/`);
    const group = page.locator(`[data-nav-disclosure="${key}"]`);
    await expect(group).toHaveAttribute("open", "");
    await expect
      .poll(() => readDisclosureStorage(page))
      .toMatchObject({ [key]: true });
    await page.evaluate(() =>
      document.dispatchEvent(new Event("hold-disclosure-toggle")),
    );
    try {
      const summary = group.locator(":scope > summary");
      if (activation === "click") await summary.click();
      else await summary.press(activation);
      await expect(group).not.toHaveAttribute("open", "");
      await expect(group).toHaveAttribute("data-test-toggle-held", "true");

      const search = page.locator("[data-mokly-search]");
      await search.fill("home");
      await expect(group).toHaveAttribute("data-filter-open", "0");
      await expect(group).toHaveAttribute("open", "");
      expect(await readDisclosureStorage(page)).toMatchObject({ [key]: false });

      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            document.dispatchEvent(new Event("release-disclosure-toggle"));
            requestAnimationFrame(() => resolve());
          }),
      );
      await expect(group).toHaveAttribute("open", "");
      await search.fill("");
      await expect(group).not.toHaveAttribute("open", "");
      expect(await readDisclosureStorage(page)).toMatchObject({ [key]: false });
    } finally {
      await page.evaluate(() =>
        document.dispatchEvent(new Event("release-disclosure-toggle")),
      );
    }
  });
}
