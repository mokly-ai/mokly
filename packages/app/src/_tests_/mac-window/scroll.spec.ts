import { write } from "../build-double";
import { numbered } from "../build-output";
import { buildScenario } from "../build-scenario";
import { expect, open, test } from "../harness";
import { build, buildId } from "../viewer/build-fixtures";

import { clearMacWindow, emulateMacWindow } from "./regions";
import {
  expectFocusClearOfTopRow,
  expectStaysOver,
  scrollToEnd,
  scrollToStart,
} from "./scroll";

/** The smallest window that the desktop app opens. */
const smallestWindow = { width: 640, height: 480 };

test("the account header scrolls away in a browser, and in the Mac window it stays over the page and keeps focus clear of it", async ({
  page,
}) => {
  await page.setViewportSize(smallestWindow);
  await open(page, "/sign-in");
  const header = page.getByRole("banner");
  const main = page.getByRole("main");
  const github = page.getByRole("button", { name: "Continue with GitHub" });
  await expect(github).toBeVisible();

  // A browser keeps its usual layout: the header scrolls with the page.
  const scrolled = await scrollToEnd(page);
  expect(scrolled, "the page is taller than the window").toBeGreaterThan(48);
  await expect
    .poll(
      async () => (await header.boundingBox())?.y,
      "the header scrolls away",
    )
    .toBe(-scrolled);
  await scrollToStart(page);

  for (const edge of ["start", "end"] as const) {
    await emulateMacWindow(page, edge);
    await scrollToEnd(page);
    const label = `the account header, buttons at the ${edge}`;
    await expectStaysOver(page, header, main, label);
    await expectFocusClearOfTopRow(
      page,
      github,
      page.getByLabel("Email"),
      `Continue with GitHub, buttons at the ${edge}`,
    );
    await clearMacWindow(page);
    await scrollToStart(page);
  }
});

test("in the Mac window, the viewer's fallback bar stays over a build card taller than the window", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "mac-window-tall-card");
  const id = buildId(86);
  scenario.double.builds.set(
    id,
    build({
      id,
      projectId: scenario.projectId,
      state: "failed",
      canCancel: false,
      failure: { step: "install", cause: "exit", exitCode: 1 },
    }),
  );
  // Enough output that the card is taller than the smallest window.
  write(scenario.double, id, numbered(1, 60));
  await page.setViewportSize(smallestWindow);
  await open(page, scenario.buildAt(id));
  await expect(page.getByTestId("build-try-again")).toBeVisible();
  await emulateMacWindow(page, "start");
  await scrollToEnd(page);
  await expectStaysOver(
    page,
    page.locator(".fo-top-bar"),
    page.locator(".fo-stage-canvas"),
    "the fallback bar",
  );
});
