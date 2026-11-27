import { expect } from "@playwright/test";

import { test as baseTest } from "./browser_test.js";
import { ownExampleServerUrl } from "./example_servers.js";
import { setFrames } from "./workspace_actions.js";

/** The Canvas tag search's own page, not one of its saved states. */
const TAG_SEARCH = /\/view\/design\/canvas\/search\/tags\/(?:\?|$)/;
const TAG_CHIP = /\/view\/design\/library\/controls\/tag-chip\//;

export function registerDesignLibraryRuntime(
  test = baseTest,
  origin = ownExampleServerUrl,
) {
  const running = {
    get url() {
      return origin()!;
    },
  };
  test("desktop: real design usage supports nested inspection, highlighting and a round trip through the library", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    // The Canvas tag search opens Welcome with the tag picker open, so its
    // top bar holds Top bar → Tag picker → Tag chip.
    await page.goto(`${running.url}/view/design/canvas/search/tags/`);
    // The Frames filter shows the Desktop Light frame alone.
    await setFrames(page, { desktop: true, mobile: false, dark: false });
    const components = page.locator('[data-inspect-section="components"]');
    await components.locator(":scope > summary").click();
    await expect(components).toHaveAttribute("open", "");
    const panel = components.locator(":scope > .mbk-inspect-fold-body");
    await expect(panel).toContainText("Top bar");
    await expect(panel).toContainText("Tag picker");
    await expect(panel).toContainText("Tag chip");
    const highlight = page.getByRole("switch", {
      name: "Highlight components",
      exact: true,
    });
    await highlight.click();
    await expect(
      page.locator('.mbk-highlight-layer[data-highlight-viewport="desktop"]'),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
    for (const summary of await panel.locator("details > summary").all()) {
      await summary.click();
      await expect(components).toHaveAttribute("open", "");
    }
    // A choice in the component tree selects the tag picker's nested chip,
    // and Inspect's Selection names its props and opens its component.
    await panel
      .getByRole("button", { name: "Tag chip · forms", exact: true })
      .click();
    const selection = page.locator('[data-inspect-section="selection"]');
    await expect(selection).toContainText("forms");
    await selection
      .getByRole("link", { name: "Tag chip", exact: true })
      .click();
    await expect(page).toHaveURL(TAG_CHIP);
    const usage = page.locator('[data-inspect-section="usage"]');
    await usage.locator(":scope > summary").click();
    await usage.getByRole("link", { name: "Tag search", exact: true }).click();
    await expect(page).toHaveURL(TAG_SEARCH);
    await page.goBack();
    await expect(page).toHaveURL(TAG_CHIP);
    await page.goForward();
    await expect(page).toHaveURL(TAG_SEARCH);
  });
}
