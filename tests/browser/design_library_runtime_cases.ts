import { expect } from "@playwright/test";

import { test as baseTest } from "./browser_test.js";
import { ownExampleServerUrl } from "./example_servers.js";
import { chooseViewport } from "./workspace_actions.js";

export function registerDesignLibraryRuntime(
  test = baseTest,
  origin = ownExampleServerUrl,
) {
  const running = {
    get url() {
      return origin()!;
    },
  };
  for (const viewport of ["desktop", "mobile"] as const) {
    test(`${viewport}: real design usage supports nested inspection, highlighting and a round trip through the library`, async ({
      page,
    }) => {
      await page.setViewportSize(
        viewport === "mobile"
          ? { width: 390, height: 844 }
          : { width: 1280, height: 900 },
      );
      await page.goto(
        `${running.url}/view/design/browse/views/screen/tag-picker/`,
      );
      await chooseViewport(page, viewport);
      await page.getByRole("tab", { name: "Components", exact: true }).click();
      if (viewport === "mobile")
        await page
          .getByRole("button", { name: "Expand inspector", exact: true })
          .click();
      const panel = page.getByRole("tabpanel", {
        name: "Components",
        exact: true,
      });
      await expect(panel).toContainText("Top bar");
      await expect(panel).toContainText("Tag picker");
      await expect(panel).toContainText("Tag chip");
      const highlight = page.getByRole("button", {
        name: "Highlight components",
        exact: true,
      });
      await highlight.click();
      await expect(
        page.locator(
          `.mbk-highlight-layer[data-highlight-viewport="${viewport}"]`,
        ),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
      for (const summary of await panel.locator("details > summary").all()) {
        await summary.click();
        await expect(
          page.getByRole("tab", { name: "Components", exact: true }),
        ).toHaveAttribute("aria-selected", "true");
      }
      await panel
        .locator(".mbk-instance-select")
        .filter({ hasText: "Tag chip" })
        .first()
        .click();
      await expect(
        page.getByRole("tabpanel", { name: "Props", exact: true }),
      ).toContainText("forms");
      await page
        .getByRole("link", { name: "Open component", exact: true })
        .click();
      await expect(page).toHaveURL(
        /\/view\/design\/library\/controls\/tag-chip\//,
      );
      await page.getByRole("tab", { name: "Usage", exact: true }).click();
      const usage = page.getByRole("tabpanel", { name: "Usage", exact: true });
      await usage
        .getByRole("link", { name: "Tag picker", exact: true })
        .first()
        .click();
      await expect(page).toHaveURL(
        /\/view\/design\/browse\/views\/screen\/tag-picker\//,
      );
      await page.goBack();
      await expect(page).toHaveURL(
        /\/view\/design\/library\/controls\/tag-chip\//,
      );
      await page.goForward();
      await expect(page).toHaveURL(
        /\/view\/design\/browse\/views\/screen\/tag-picker\//,
      );
    });
  }
}
