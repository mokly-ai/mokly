import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

import { focusDesignLink } from "./design_test_helpers.js";
import {
  chooseScheme,
  chooseViewport,
  expectFrameLoaded,
  expectFrameSource,
} from "./workspace_actions.js";

for (const viewport of ["mobile", "desktop"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test(`${viewport}/${scheme}: the basic example buttons work in Browse and on disk`, async ({
      page,
    }) => {
      if (viewport === "mobile" && scheme === "dark")
        await page.route(
          "**/static/.generated/screens/welcome.mobile.dark.html",
          async (route) => {
            await setTimeout(500);
            await route.continue();
          },
        );
      await page.goto("/view/screens/welcome.html");
      await chooseViewport(page, viewport);
      if (scheme === "dark") await chooseScheme(page, "dark");
      const suffix = `${viewport}${scheme === "dark" ? ".dark" : ""}.html`;
      const frameElement = page.locator(`.mbk-frame-${viewport} iframe`);
      await expectFrameLoaded(
        frameElement,
        new RegExp(
          `/static/\\.generated/screens/welcome\\.${suffix.replaceAll(".", "\\.")}$`,
        ),
      );
      const frame = frameElement.contentFrame();
      const next = frame.getByRole("link", {
        name: "View details",
        exact: true,
      });
      await expect(next).toHaveAttribute("data-mokly-link-control", "button");
      await frame.getByRole("textbox", { name: "Workspace name" }).focus();
      await page.keyboard.press("Tab");
      await expect(next).toBeFocused();
      await expect(next).toHaveCSS("outline-width", "2px");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(
        /\/view\/screens\/details\.html\?fragment=details$/,
      );
      await expectFrameSource(
        page.locator(`.mbk-frame-${viewport} iframe`),
        new RegExp(
          `details\\.${viewport}${scheme === "dark" ? "\\.dark" : ""}\\.html#details$`,
        ),
      );
      await frame
        .locator('a[data-mokly-link-control="button"]')
        .filter({ hasText: "Return to welcome" })
        .click();
      await expect(page).toHaveURL(/\/view\/screens\/welcome\.html$/);

      await page.goto(
        pathToFileURL(
          path.join(
            repositoryRoot,
            `examples/basic/.generated/screens/welcome.${suffix}`,
          ),
        ).href,
      );
      await page
        .getByRole("link", { name: "View details", exact: true })
        .click();
      await expect(page).toHaveURL(
        new RegExp(
          `/screens/details\\.${suffix.replaceAll(".", "\\.")}#details$`,
        ),
      );
      const back = page
        .locator('a[data-mokly-link-control="button"]')
        .filter({ hasText: "Return to welcome" });
      await page.waitForLoadState("load");
      await focusDesignLink(back);
      await expect(back).toBeFocused();
      await expect(back).toHaveCSS("outline-style", "solid");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(
        new RegExp(`/screens/welcome\\.${suffix.replaceAll(".", "\\.")}$`),
      );
    });
  }
}

test("the real example tour reuses the styled buttons in both owning screens", async ({
  page,
}) => {
  for (const scheme of ["light", "dark"] as const) {
    for (const step of [0, 1]) {
      await page.goto("/view/user-flows/example-tour.html");
      await chooseScheme(page, scheme);
      const frame = page.frameLocator(".mbk-flow-screen iframe").nth(step);
      const button = frame
        .locator('a[data-mokly-link-control="button"]')
        .filter({ hasText: step === 0 ? "View details" : "Return to welcome" });
      if (step === 0) await button.click();
      else {
        await focusDesignLink(button);
        await page.keyboard.press("Enter");
      }
      await expect(page).toHaveURL(
        step === 0
          ? /\/view\/screens\/details\.html\?fragment=details$/
          : /\/view\/screens\/welcome\.html$/,
      );
    }
  }
});
