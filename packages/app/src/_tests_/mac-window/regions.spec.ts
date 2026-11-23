import type { Page } from "@playwright/test";

import { branchPathFor } from "../addresses";
import { failWith } from "../api-responses";
import { expect, open, test } from "../harness";
import { notFoundPaths } from "../not-found-cases";
import {
  openAccountMenu,
  publishedProject,
  publishedViewerReady,
} from "../viewer/support";

import {
  clearMacWindow,
  emulateMacWindow,
  expectBarRegions,
  expectBarsClearOfButtons,
  expectMovesWindow,
  expectTakesClicks,
  expectTakesClicksThroughout,
  partsUnderButtons,
  spaceAfter,
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
  // The whole pill is one control, so no press on it moves the window, on
  // its hairline neither.
  await emulateMacWindow(page, "start");
  await expectTakesClicksThroughout(
    page,
    fallback.locator(".fo-canvas-pill"),
    "the fallback bar's pill",
  );
  await clearMacWindow(page);

  await open(page, made.publicationPath);
  await publishedViewerReady(page);
  const start = page.locator(".fo-package-slot-start");
  const centre = page.locator(".fo-package-slot-center");
  for (const [width, composition] of [
    [1440, "full"],
    [960, "compact"],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByTestId(
        composition === "full" ? "viewer-history" : "viewer-more",
      ),
    ).toBeVisible();
    // The compact bar leaves the start slot empty.
    const slots = {
      ...(composition === "full" && { "start slot": start }),
      "centre slot": centre,
      "end slot": page.locator(".fo-package-slot-end"),
    };
    for (const [label, slot] of Object.entries(slots)) {
      await expectBarRegions(slot, `the ${composition} bar's ${label}`);
    }
    await expectBarsClearOfButtons(page, slots);
    await emulateMacWindow(page, "start");
    await expectTakesClicksThroughout(
      page,
      centre.locator(".fo-canvas-pill"),
      `the ${composition} bar's pill`,
    );
    await clearMacWindow(page);
    // The space after the project, up to the pill, and on the compact bar the
    // space after the pill, up to the search, belong to the cloud's slots, so
    // they move the window too.
    const [part, slot, label] =
      composition === "full"
        ? [page.getByTestId("viewer-project"), start, "after the project"]
        : [page.getByTestId("viewer-publication"), centre, "after the pill"];
    await expect
      .poll(() => spaceAfter(page, part, slot), `the space ${label}`)
      .toEqual({ width: expect.any(Number), region: "drag" });
    expect((await spaceAfter(page, part, slot)).width).toBeGreaterThan(16);
  }

  // A dialog or a menu over the bar takes its clicks.
  await page.getByTestId("viewer-more").click();
  const menu = page.getByRole("menu", { name: "More" });
  await expectTakesClicks(menu, "More's menu");
  await menu.getByRole("menuitem", { name: "History", exact: true }).click();
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
  await expectTakesClicks(page.getByRole("dialog"), "the History panel");
  await page.getByTestId("close-history").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.setViewportSize({ width: 1440, height: 900 });
  const account = await openAccountMenu(page);
  await expectTakesClicks(account, "the account menu");
  await account
    .getByRole("menuitem", { name: "Settings", exact: true })
    .click();
  await expect(page.getByTestId("settings-dialog")).toBeVisible();
  await expectTakesClicks(page.getByRole("dialog"), "the settings dialog");
});

test("the viewer package's mark comes after the Mac window's buttons in both compositions", async ({
  page,
}) => {
  const made = await publishedProject(page, "mac-window-viewer-mark");
  await open(page, made.publicationPath);
  await publishedViewerReady(page);
  // The package's start column: its menu button where it shows, its mark and
  // the cloud's start slot.
  const start = page
    .locator("[data-mokly-shell]")
    .getByRole("link", { name: "Mokly", exact: true })
    .locator("..");
  for (const [width, composition] of [
    [1440, "full"],
    [960, "compact"],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByTestId(
        composition === "full" ? "viewer-history" : "viewer-more",
      ),
    ).toBeVisible();
    await emulateMacWindow(page, "start");
    await expect
      .poll(
        () => partsUnderButtons(start, "start"),
        `the ${composition} bar's mark keeps clear of the buttons`,
      )
      .toEqual([]);
    await clearMacWindow(page);
  }
});
