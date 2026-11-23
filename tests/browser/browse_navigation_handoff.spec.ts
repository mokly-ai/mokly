/**
 * Frame link ownership at the edges of a frame's life, under the frame link
 * navigation and navigation contracts: right after the first mount, while the
 * desktop document still loads, and while a Props reset replaces a document
 * with the exact resource that the frame already shows.
 */

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
  await routeNavigationNestedFrame(page);
});

test("a logical link right after the first mount is host-owned while the frame still loads", async ({
  page,
}) => {
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let images = 0;
  // The desktop documents, Light and Dark on the canvas, cannot finish
  // loading while their image is held.
  await page.route("**/slow-navigation-desktop.svg", async (route) => {
    images += 1;
    await held;
    await route.continue();
  });
  const opened = page.goto(
    `${navigation.url}/view/fixture/nested/home/?viewport=desktop`,
  );
  try {
    await expect.poll(() => images).toBe(2);
    const frame = page.locator(canvasFrame("desktop"));
    await expect(frame).toHaveAttribute("data-mokly-frame-state", "loading");
    await page
      .frameLocator(canvasFrame("desktop"))
      .locator("#raw-link")
      .evaluate((element) =>
        element.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        ),
      );
    await expectDestination(page);
    expect(images).toBe(2);
  } finally {
    release();
    await opened;
  }
});

test("a Props reset that loads the exact resource the frame shows keeps the old document frame-owned", async ({
  page,
  allowBrowserError,
}) => {
  allowBrowserError(renderedNestedDocument);
  const saved = "/static/mokly-generated/fixture/nested/home/index.mobile.html";
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.goto(`${navigation.url}/view/fixture/nested/home/`);
  const element = page.locator(canvasFrame("mobile"));
  const frame = page.frameLocator(canvasFrame("mobile"));
  const documentUrl = () =>
    element.evaluate(
      (iframe: HTMLIFrameElement) => iframe.contentDocument?.URL ?? "",
    );
  // An edit's render replaces the frame's document; Reset replaces the
  // render with the saved document again.
  const props = await showProps(page);
  const note = props.getByRole("textbox", { name: "note" });
  await expect(note).toBeEditable();
  await note.fill("Edited");
  await expect
    .poll(documentUrl)
    .toMatch(
      /\/mokly-viewer\/components\/renders\/[^/]+\/static\/mokly-generated\/fixture\/nested\/home\/index\.mobile\.html$/u,
    );
  await expect(frame.locator("#note")).toHaveText("Edited");
  await expect(element).toHaveAttribute("data-mokly-frame-state", "ready");
  // The frame's own navigation loads the saved document; the shell's
  // replacement of the same resource waits until the test releases it. A
  // document links to the saved document by no portable relative path, so
  // the frame's window navigates.
  await page.route(
    (url) => url.pathname === saved,
    async (route) => {
      requests += 1;
      if (requests > 1) await held;
      await route.continue();
    },
  );
  await element.evaluate(
    (iframe: HTMLIFrameElement, url) =>
      iframe.contentWindow!.location.assign(url),
    saved,
  );
  await expect
    .poll(documentUrl)
    .toMatch(new RegExp(`${saved.replaceAll(".", "\\.")}$`));
  try {
    await props.getByRole("button", { name: "Reset to Home" }).click();
    await expect.poll(() => requests).toBe(2);
    await expect(element).toHaveAttribute("data-mokly-frame-state", "loading");
    // The document that the frame navigated to itself stays frame-owned: the
    // shell does not take its logical link while the replacement loads.
    const prevented = await element.evaluate((iframe: HTMLIFrameElement) => {
      const doc = iframe.contentDocument!;
      let defaultPrevented: boolean | undefined;
      doc.addEventListener(
        "click",
        (event) => {
          defaultPrevented = event.defaultPrevented;
          event.preventDefault();
        },
        { once: true },
      );
      doc
        .querySelector("#mock-link")!
        .dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
      return defaultPrevented;
    });
    expect(prevented).toBe(false);
    await expect(page).toHaveURL(/\/view\/fixture\/nested\/home\/$/);
    await expect(page.locator("#mb-main h2")).toHaveText("Home");

    release();
    await expect(element).toHaveAttribute("data-mokly-frame-state", "ready");
    await frame.locator("#mock-link").click();
    await expectDestination(page);
  } finally {
    release();
  }
});
