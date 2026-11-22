import type { Page } from "@playwright/test";

import { branchPathFor } from "../addresses";
import { failWith } from "../api-responses";
import { expect, open, test } from "../harness";
import { notFoundPaths } from "../not-found-cases";
import { publishedProject, publishedViewerReady } from "../viewer/support";

import {
  clearMacWindow,
  emulateMacWindow,
  expectBarRegions,
  expectBarsClearOfButtons,
  expectMovesWindow,
  expectTakesClicks,
  windowInsets,
} from "./regions";

/** Full-page states with a top area that moves the Mac window. */
const windowScreens: readonly {
  name: string;
  area: ".fo-window-band" | ".fo-account-header";
  browserHeight: "0px" | "48px";
  open: (page: Page) => Promise<void>;
}[] = [
  {
    name: "Not found",
    area: ".fo-window-band",
    browserHeight: "0px",
    open: async (page) => {
      await open(page, notFoundPaths[0]);
      await expect(
        page.getByRole("heading", { level: 1, name: "Page not found" }),
      ).toBeVisible();
    },
  },
  {
    // The desktop app shows this frame at start, and when it is offline.
    name: "the session error",
    area: ".fo-account-header",
    browserHeight: "48px",
    open: async (page) => {
      await failWith(page, "**/v1/session", "GET", "unavailable");
      await open(page, "/dashboard");
      await expect(
        page.getByRole("heading", { level: 1, name: "Mokly couldn’t load" }),
      ).toBeVisible();
    },
  },
];

test("a browser reports no window buttons and keeps each screen's usual top area height", async ({
  page,
}) => {
  for (const screen of windowScreens) {
    await screen.open(page);
    await expect
      .poll(() => windowInsets(page), `${screen.name}: the window insets`)
      .toEqual({ start: "0px", end: "0px" });
    const area = page.locator(screen.area);
    await expectMovesWindow(area, `${screen.name}'s top area`);
    await expect(area, `${screen.name}'s usual height in a browser`).toHaveCSS(
      "height",
      screen.browserHeight,
    );
  }
});

test("the full-page states move the Mac window from a 48px top area", async ({
  page,
}) => {
  for (const screen of windowScreens) {
    await screen.open(page);
    const area = page.locator(screen.area);
    for (const edge of ["start", "end"] as const) {
      await emulateMacWindow(page, edge);
      await expectMovesWindow(
        area,
        `${screen.name}'s top area, buttons at the ${edge}`,
      );
      await expect(
        area,
        `${screen.name}'s top area, buttons at the ${edge}`,
      ).toHaveCSS("height", "48px");
      // The top area takes its height from the page's canvas, so the page does
      // not scroll.
      await expect
        .poll(
          () =>
            page.evaluate(
              () => document.documentElement.scrollHeight - window.innerHeight,
            ),
          `${screen.name} keeps the window's height`,
        )
        .toBe(0);
      await clearMacWindow(page);
    }
  }
});

test("the account header moves the window and keeps clear of its buttons, and its link takes clicks", async ({
  page,
}) => {
  await open(page, "/auth/email?email=" + encodeURIComponent("a@example.com"));
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expectBarRegions(header, "the account header");
  await expectBarsClearOfButtons(page, { "the account header": header });
});

test("the viewer's cloud bars move the window and keep clear of its buttons, while their controls and overlays take clicks", async ({
  page,
}) => {
  const made = await publishedProject(page, "mac-window-viewer");

  // A branch with nothing published keeps the cloud's own fallback bar.
  await open(page, await branchPathFor(page, made.projectId, "unpublished"));
  const fallback = page.locator(".fo-top-bar");
  await expect(fallback.getByTestId("viewer-history")).toBeVisible();
  await expectBarRegions(fallback, "the fallback bar");
  await expectBarsClearOfButtons(page, { "the fallback bar": fallback });

  await open(page, made.publicationPath);
  await publishedViewerReady(page);
  const slots = {
    "start slot": page.locator(".fo-package-slot-start"),
    "end slot": page.locator(".fo-package-slot-end"),
  };
  for (const [width, composition] of [
    [1440, "full"],
    [1024, "compact"],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByTestId(
        composition === "full" ? "viewer-history" : "viewer-more",
      ),
    ).toBeVisible();
    for (const [label, slot] of Object.entries(slots)) {
      await expectBarRegions(slot, `the ${composition} bar's ${label}`);
    }
    await expectBarsClearOfButtons(page, slots);
  }

  // A dialog or a menu over the bar takes its clicks.
  await page.getByTestId("viewer-more").click();
  const menu = page.getByRole("menu", { name: "Viewer actions" });
  await expectTakesClicks(menu, "More's menu");
  await menu.getByText("History", { exact: true }).click();
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
  await expectTakesClicks(page.getByRole("dialog"), "the History panel");
  await page.getByTestId("close-history").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId("viewer-settings").click();
  await expectTakesClicks(page.getByRole("dialog"), "the settings dialog");
});
