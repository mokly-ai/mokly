/**
 * The Frames filter's viewport toggles under the canvas stage contract: they
 * show and set the selection's viewport, so the address of a standalone shell
 * and the selection of a controlled host keep the shown viewport, in both
 * layouts.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import type { ViewerSelection } from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import { test } from "./browser_test.js";
import type {} from "./viewer_harness.js";
import { canvasFrame, NARROW_WINDOW, setFrames } from "./workspace_actions.js";

const WELCOME = "/view/example/screens/welcome/";

/** A toggle of the Frames filter in Inspect. */
function toggle(scope: Page | Locator, name: "desktop" | "mobile"): Locator {
  return scope
    .getByRole("group", { name: "Frames" })
    .locator(`[data-frames-toggle="${name}"]`);
}

test("turning Mobile off names Desktop in the address, which opens on the Desktop frames alone", async ({
  page,
}) => {
  await page.goto(WELCOME);
  await expect(page.locator(canvasFrame("mobile"))).toBeVisible();
  await setFrames(page, { mobile: false });
  await expect(page).toHaveURL(
    /\/view\/example\/screens\/welcome\/\?viewport=desktop$/,
  );
  await expect(page.locator(canvasFrame("mobile"))).toBeHidden();
  await page.reload();
  await expect(toggle(page, "desktop")).toBeChecked();
  await expect(toggle(page, "mobile")).not.toBeChecked();
  await expect(page.locator(canvasFrame("desktop"))).toBeVisible();
  await expect(page.locator(canvasFrame("mobile"))).toBeHidden();
});

test("the compact layout picks the wide canvas's viewport, and its pick sets the wide toggles", async ({
  page,
}) => {
  await page.goto(`${WELCOME}?viewport=desktop`);
  await expect(page.locator(canvasFrame("mobile"))).toBeHidden();
  await page.setViewportSize(NARROW_WINDOW);
  const picker = page.getByRole("combobox", { name: "Frame" });
  await expect(picker).toHaveValue("desktop-light");
  // The selection's viewport names the picked frame, so the picker keeps
  // the frames of both viewports.
  await expect(picker.locator("option")).toHaveText([
    "Mobile · Light",
    "Mobile · Dark",
    "Desktop · Light",
    "Desktop · Dark",
  ]);
  await picker.selectOption({ label: "Mobile · Light" });
  await expect(page).toHaveURL(/\?viewport=mobile$/);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(toggle(page, "mobile")).toBeChecked();
  await expect(toggle(page, "desktop")).not.toBeChecked();
  await expect(page.locator(canvasFrame("mobile"))).toBeVisible();
  await expect(page.locator(canvasFrame("desktop"))).toBeHidden();
});

test.describe("a controlled host", () => {
  let fixture: Awaited<ReturnType<typeof viewerFixture>>;
  test.beforeAll(async () => {
    fixture = await viewerFixture();
  });
  test.afterAll(async () => {
    await fixture?.close();
  });

  test("hears the viewport of the toggles that stay on, and its selection sets the toggles", async ({
    page,
  }) => {
    await page.goto(fixture.host.url);
    await page.waitForFunction(() => Boolean(window.viewerHarness));
    await page.evaluate(() =>
      window.viewerHarness.start("one", {
        controlled: true,
        defaultSelection: { viewport: "both" },
      }),
    );
    const root = page.locator("#one");
    await expect(root.locator(canvasFrame("mobile"))).toBeVisible();
    await toggle(root, "mobile").click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.viewerHarness
            .get("one")
            .events.filter((event) => event.name === "selection")
            .map((event) => (event.value as ViewerSelection).viewport),
        ),
      )
      .toEqual(["desktop"]);
    // The proposal waits for the host, so both viewports still show.
    await expect(toggle(root, "mobile")).toBeChecked();
    await expect(root.locator(canvasFrame("mobile"))).toBeVisible();
    await page.evaluate(() => {
      const host = window.viewerHarness.get("one");
      host.setSelection({ ...host.props.selection!, viewport: "desktop" });
    });
    await expect(toggle(root, "mobile")).not.toBeChecked();
    await expect(root.locator(canvasFrame("mobile"))).toBeHidden();
    await expect(root.locator(canvasFrame("desktop"))).toBeVisible();
  });
});
