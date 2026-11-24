import { expect, type Page } from "@playwright/test";

import { test as baseTest } from "./browser_test.js";
import { useCaseStepFrame, useCaseSteps } from "./use_case_steps.js";
import {
  canvasFrame,
  chooseScheme,
  expectFrameSource,
} from "./workspace_actions.js";

/** The routed screen's canvas frames: Desktop and Mobile, Light and Dark. */
const FRAMES = "iframe[data-workspace-frame][data-workspace-color-scheme]";

/** Run the same assertions against each catalogue delivery. */
export function registerServeFragments(test = baseTest) {
  /** Expect each frame's document, by the frame's own scheme. */
  async function expectSources(
    page: Page,
    source: (dark: string) => RegExp,
  ): Promise<void> {
    const frames = page.locator(FRAMES);
    await expect(frames).toHaveCount(4);
    for (const frame of await frames.all()) {
      const scheme = await frame.getAttribute("data-workspace-color-scheme");
      await expectFrameSource(
        frame,
        source(scheme === "dark" ? "\\.dark" : ""),
      );
    }
  }
  /** Each frame keeps its own scheme's document, opened at the fragment. */
  async function expectFragments(page: Page, fragment: string) {
    await expectSources(
      page,
      (dark) =>
        new RegExp(`/index\\.(mobile|desktop)${dark}\\.html#${fragment}$`),
    );
  }
  async function expectTop(page: Page) {
    for (const frame of await page.locator(FRAMES).all())
      await expect
        .poll(() =>
          frame.evaluate(
            (element: HTMLIFrameElement) => element.contentWindow!.scrollY,
          ),
        )
        .toBe(0);
  }
  test("direct screen fragments update current and keep each frame's scheme", async ({
    page,
  }) => {
    await page.goto("/view/example/screens/details/?fragment=details");
    await expectFragments(page, "details");
    await chooseScheme(page, "dark");
    await expectFragments(page, "details");
    await page.goto("/view/example/screens/details/?fragment=absent-anchor");
    await expectFragments(page, "absent-anchor");
    await expectTop(page);
    await chooseScheme(page, "dark");
    await expectFragments(page, "absent-anchor");
    await expectTop(page);
  });
  test("invalid and duplicate direct fragments leave every source unchanged", async ({
    page,
  }) => {
    for (const query of [
      "fragment=%23details",
      "fragment=details&fragment=other",
    ]) {
      await page.goto(`/view/example/screens/details/?${query}`);
      const plain = (dark: string) =>
        new RegExp(`/details/index\\.(mobile|desktop)${dark}\\.html$`);
      await expectSources(page, plain);
      await chooseScheme(page, "dark");
      await expectSources(page, plain);
    }
  });
  test("use-case fragments apply to the first step only", async ({ page }) => {
    await page.goto("/view/example/tour/?fragment=welcome");
    await expect(useCaseSteps(page)).toHaveCount(2);
    const first = useCaseStepFrame(page, 1);
    const second = useCaseStepFrame(page, 2);
    await expectFrameSource(first, /#welcome$/);
    await expectFrameSource(second, /\.html$/);
    // The use case keeps its own Light frames under Dark, and the fragment
    // still belongs to the first step alone.
    await chooseScheme(page, "dark");
    await expectFrameSource(first, /\/index\.desktop\.html#welcome$/);
    await expectFrameSource(second, /\/index\.desktop\.html$/);
  });
  test("a logical link retains its fragment through navigation and swaps", async ({
    page,
  }) => {
    await page.goto("/view/example/screens/welcome/");
    await page
      .frameLocator(canvasFrame("mobile"))
      .getByRole("link", { name: "Open the details screen", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/view\/example\/screens\/details\/\?fragment=details$/,
    );
    await expectFragments(page, "details");
    await chooseScheme(page, "dark");
    await expectFragments(page, "details");
  });
}
