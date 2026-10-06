import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

import { focusLink } from "./link_focus.js";
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
          "**/static/example/screens/welcome/index.mobile.dark.html",
          async (route) => {
            await setTimeout(500);
            await route.continue();
          },
        );
      await page.goto("/view/example/screens/welcome/");
      await chooseViewport(page, viewport);
      if (scheme === "dark") await chooseScheme(page, "dark");
      const suffix = `${viewport}${scheme === "dark" ? ".dark" : ""}.html`;
      const frameElement = page.locator(`.mbk-frame-${viewport} iframe`);
      await expectFrameLoaded(
        frameElement,
        new RegExp(
          `/static/example/screens/welcome/index\\.${suffix.replaceAll(".", "\\.")}$`,
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
        /\/view\/example\/screens\/details\/\?fragment=details$/,
      );
      await expectFrameSource(
        page.locator(`.mbk-frame-${viewport} iframe`),
        new RegExp(
          `example/screens/details/index\\.${viewport}${scheme === "dark" ? "\\.dark" : ""}\\.html#details$`,
        ),
      );
      await expectFrameLoaded(
        frameElement,
        new RegExp(
          `example/screens/details/index\\.${viewport}${scheme === "dark" ? "\\.dark" : ""}\\.html#details$`,
        ),
      );
      await expect(frameElement).toHaveAttribute(
        "data-mokly-frame-state",
        "ready",
      );
      await frame
        .locator('a[data-mokly-link-control="button"]')
        .filter({ hasText: "Return to welcome" })
        .click();
      await expect(page).toHaveURL(/\/view\/example\/screens\/welcome\/$/);

      await page.goto(
        pathToFileURL(
          path.join(
            repositoryRoot,
            `examples/basic/generated/example/screens/welcome/index.${suffix}`,
          ),
        ).href,
      );
      await page
        .getByRole("link", { name: "View details", exact: true })
        .click();
      await expect(page).toHaveURL(
        new RegExp(
          `/example/screens/details/index\\.${suffix.replaceAll(".", "\\.")}#details$`,
        ),
      );
      const back = page
        .locator('a[data-mokly-link-control="button"]')
        .filter({ hasText: "Return to welcome" });
      await page.waitForLoadState("load");
      await focusLink(back);
      await expect(back).toBeFocused();
      await expect(back).toHaveCSS("outline-style", "solid");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(
        new RegExp(
          `/example/screens/welcome/index\\.${suffix.replaceAll(".", "\\.")}$`,
        ),
      );
    });
  }
}

test("the real example tour reuses the styled buttons in both owning screens", async ({
  page,
}) => {
  for (const scheme of ["light", "dark"] as const) {
    for (const step of [0, 1]) {
      await page.goto("/view/example/tour/");
      await chooseScheme(page, scheme);
      const frame = page.frameLocator(".mbk-flow-screen iframe").nth(step);
      const button = frame
        .locator('a[data-mokly-link-control="button"]')
        .filter({ hasText: step === 0 ? "View details" : "Return to welcome" });
      if (step === 0) await button.click();
      else {
        await focusLink(button);
        await page.keyboard.press("Enter");
      }
      await expect(page).toHaveURL(
        step === 0
          ? /\/view\/example\/screens\/details\/\?fragment=details$/
          : /\/view\/example\/screens\/welcome\/$/,
      );
    }
  }
});

for (const delayedStyles of [false, true])
  test(`desktop frame-link history keeps its viewport and source${delayedStyles ? " while styles load" : ""}`, async ({
    page,
  }) => {
    await page.goto("/view/example/screens/welcome/");
    await chooseViewport(page, "desktop");
    const iframe = page.locator(".mbk-frame-desktop iframe");
    await expectFrameLoaded(
      iframe,
      /\/static\/example\/screens\/welcome\/index\.desktop\.html$/,
    );
    let delayedRequests = 0;
    if (delayedStyles)
      await page.route("**/static/example-components.css", async (route) => {
        delayedRequests += 1;
        await setTimeout(500);
        await route.continue();
      });
    try {
      await expect(iframe).toHaveAttribute("data-mokly-frame-state", "ready");
      await iframe
        .contentFrame()
        .getByRole("link", { name: "View details", exact: true })
        .click();
      await expect(page).toHaveURL(
        /\/view\/example\/screens\/details\/\?fragment=details$/,
      );
      await expectFrameLoaded(
        iframe,
        /\/static\/example\/screens\/details\/index\.desktop\.html#details$/,
      );
      await expect(
        page.locator(
          '[data-nav-row][data-route="example/screens/details/index.html"]',
        ),
      ).toHaveAttribute("aria-current", "page");
      await expect(page.locator("[data-mokly-stage]")).toHaveAttribute(
        "data-viewport",
        "desktop",
      );
      if (delayedStyles) expect(delayedRequests).toBeGreaterThan(0);
      await expect(iframe).toHaveAttribute("data-mokly-frame-state", "ready");
      await iframe
        .contentFrame()
        .locator('a[data-mokly-link-control="button"]')
        .filter({ hasText: "Return to welcome" })
        .click();
      await expect(page).toHaveURL(/\/view\/example\/screens\/welcome\/$/);
      await page.goBack();
      await expect(page).toHaveURL(
        /\/view\/example\/screens\/details\/\?fragment=details$/,
      );
      await expectFrameSource(
        iframe,
        /\/static\/example\/screens\/details\/index\.desktop\.html#details$/,
      );
      await expect(page.locator("[data-mokly-stage]")).toHaveAttribute(
        "data-viewport",
        "desktop",
      );
      await page.goBack();
      await expectFrameSource(
        iframe,
        /\/static\/example\/screens\/welcome\/index\.desktop\.html$/,
      );
      await page.goForward();
      await expectFrameSource(
        iframe,
        /\/static\/example\/screens\/details\/index\.desktop\.html#details$/,
      );
    } finally {
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });
