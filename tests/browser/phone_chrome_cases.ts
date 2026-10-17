import path from "node:path";

import { expect } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

import { test as baseTest } from "./browser_test.js";
import { designFileUrl as servedDesignFileUrl } from "./design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";
import { copiedDesignFileUrl } from "./static_test.js";
import { chooseViewport } from "./workspace_actions.js";

export function registerPhoneChrome(
  test = baseTest,
  mode: "serve" | "static" = "serve",
) {
  const designFileUrl =
    mode === "static" ? copiedDesignFileUrl : servedDesignFileUrl;
  test.beforeEach(({ allowBrowserError, baseURL }) =>
    documentFavicon(allowBrowserError, baseURL!),
  );
  for (const width of [390, 1280]) {
    test(`phone decoration leaves the embedded preview hit-testable at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/view/example/screens/welcome/");
      await chooseViewport(page, "mobile");
      const home = page.locator(
        ".mbk-frame-mobile > .phone-frame > .phone-home",
      );
      await home.scrollIntoViewIfNeeded();
      const hit = await home.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        return document.elementFromPoint(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        )?.tagName;
      });
      expect(hit).toBe("IFRAME");
      await expect(home).toHaveCSS("pointer-events", "none");
      await expect(home).toHaveAttribute("aria-hidden", "true");
      await expect(page.locator(".mbk-frame-mobile .phone-notch")).toHaveCSS(
        "pointer-events",
        "none",
      );
    });

    test(`standalone phone designs retain non-interactive decoration at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      const viewport = width < 700 ? "mobile" : "desktop";
      const file = path.join(
        repositoryRoot,
        `examples/basic/mokly-generated/design/library/preview/device-frame/phone/index.${viewport}.html`,
      );
      await page.goto(designFileUrl(file).href);
      for (const selector of [".phone-home", ".phone-notch"]) {
        const decoration = page.locator(selector);
        await expect(decoration).toBeVisible();
        await expect(decoration).toHaveCSS("pointer-events", "none");
        await expect(decoration).toHaveAttribute("aria-hidden", "true");
      }
    });
  }
}
