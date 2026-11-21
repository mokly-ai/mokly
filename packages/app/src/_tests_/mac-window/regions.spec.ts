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

/** The full-page screens without a top bar, each opened as a reader meets it. */
const bandScreens: readonly {
  name: string;
  open: (page: Page) => Promise<void>;
}[] = [
  {
    name: "Not found",
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
    open: async (page) => {
      await failWith(page, "**/v1/session", "GET", "unavailable");
      await open(page, "/dashboard");
      await expect(page.getByText("Mokly couldn’t load")).toBeVisible();
    },
  },
];

test("a browser reports no window buttons, so no inset or band takes room", async ({
  page,
}) => {
  for (const screen of bandScreens) {
    await screen.open(page);
    await expect
      .poll(() => windowInsets(page), `${screen.name}: the window insets`)
      .toEqual({ start: "0px", end: "0px" });
    const band = page.locator(".fo-window-band");
    await expectMovesWindow(band, `${screen.name}'s band`);
    await expect(band, `${screen.name}'s band has no height`).toHaveCSS(
      "height",
      "0px",
    );
  }
});

test("a screen without a top bar moves the Mac window from a 48px band", async ({
  page,
}) => {
  for (const screen of bandScreens) {
    await screen.open(page);
    const band = page.locator(".fo-window-band");
    for (const edge of ["start", "end"] as const) {
      await emulateMacWindow(page, edge);
      await expect(
        band,
        `${screen.name}'s band, buttons at the ${edge}`,
      ).toHaveCSS("height", "48px");
      // The band takes its height from the page's canvas, so the page does
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
