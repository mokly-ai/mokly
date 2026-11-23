import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { showProps } from "./live_props.js";
import { expectDestination } from "./navigation_destination.js";
import {
  nestedScriptNotice,
  renderedNestedDocument,
} from "./navigation_error_allowances.js";
import {
  routeNavigationNestedFrame,
  startNavigationFixture,
  type NavigationFixture,
} from "./navigation_fixture.js";
import { canvasFrame } from "./workspace_actions.js";

let navigation: NavigationFixture;

test.beforeAll(async () => {
  navigation = await startNavigationFixture();
});

test.afterAll(async () => {
  await navigation.close();
});

test.beforeEach(async ({ page, allowBrowserError }) => {
  allowBrowserError(nestedScriptNotice);
  await routeNavigationNestedFrame(
    page,
    '<a data-mokly-link="details#section" href="/details" id="cross-marked" target="_top">Marked</a><a href="#ordinary" id="cross-unmarked" target="_top">Ordinary</a><a href="#popup" id="cross-popup" target="_blank">Popup</a><script>parent.__crossScriptRan=true</script>',
  );
});

test("an unowned frame document stays frame-owned during shell replacement", async ({
  page,
  allowBrowserError,
}) => {
  allowBrowserError(renderedNestedDocument);
  // A Props edit replaces each shown frame's document with the edit's
  // render; a canvas frame keeps its own scheme through an appearance change.
  await page.goto(`${navigation.url}/view/fixture/nested/home/`);
  const element = page.locator(canvasFrame("mobile"));
  const frame = page.frameLocator(canvasFrame("mobile"));
  await frame.locator("#unowned-details-link").click();
  await expect(frame.locator("#extra-link")).toBeVisible();

  let releaseRequest = () => {};
  let reportRequest = () => {};
  const requestStarted = new Promise<void>((resolve) => {
    reportRequest = resolve;
  });
  const requestReleased = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  // The render of the Mobile · Light frame waits until the test releases it.
  await page.route(
    (url) =>
      /^\/mokly-viewer\/components\/renders\/[^/]+\/static\/mokly-generated\/fixture\/nested\/home\/index\.mobile\.html$/u.test(
        url.pathname,
      ),
    async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      reportRequest();
      await requestReleased;
      await route.continue();
    },
  );

  try {
    const props = await showProps(page);
    const note = props.getByRole("textbox", { name: "note" });
    await expect(note).toBeEditable();
    await note.fill("Edited");
    await requestStarted;
    await expect(element).toHaveAttribute("data-mokly-frame-state", "loading");

    const defaultPrevented = await element.evaluate(
      (iframe: HTMLIFrameElement) => {
        const doc = iframe.contentDocument!;
        const link = doc.querySelector("#extra-link")!;
        let prevented: boolean | undefined;
        doc.addEventListener(
          "click",
          (event) => {
            prevented = event.defaultPrevented;
            event.preventDefault();
          },
          { once: true },
        );
        link.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
          }),
        );
        return prevented;
      },
    );
    expect(defaultPrevented).toBe(false);
    await expect(page).toHaveURL(/\/view\/fixture\/nested\/home\/$/);
    await expect(page.locator("#mb-main h2")).toHaveText("Home");

    releaseRequest();
    await expect(element).toHaveAttribute("data-mokly-frame-state", "ready");
    await expect(frame.locator("#note")).toHaveText("Edited");
    await frame.locator("#mock-link").click();
    await expectDestination(page);
  } finally {
    releaseRequest();
  }
});
