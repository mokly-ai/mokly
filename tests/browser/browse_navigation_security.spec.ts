import { expect, type Page } from "@playwright/test";

import {
  startSuite,
  stopSuite,
  suiteState,
} from "./browse_navigation_security_fixture.js";
import { test } from "./browser_test.js";
import { expectDestination } from "./navigation_destination.js";
import {
  nestedScriptNotice,
  navigationDenials,
} from "./navigation_error_allowances.js";
import { routeNavigationNestedFrame } from "./navigation_fixture.js";
import { canvasFrame } from "./workspace_actions.js";

test.beforeAll(startSuite);

test.afterAll(stopSuite);

test.beforeEach(async ({ page, allowBrowserError }) => {
  allowBrowserError(nestedScriptNotice);
  await routeNavigationNestedFrame(
    page,
    '<a data-mokly-link="details#section" href="/details" id="cross-marked" target="_top">Marked</a><a href="#ordinary" id="cross-unmarked" target="_top">Ordinary</a><a href="#popup" id="cross-popup" target="_blank">Popup</a><script>parent.__crossScriptRan=true</script>',
  );
});

/** The canonical view address that each popup and in-place step opens. */
const DETAILS_VIEW = "/view/fixture/nested/details/?fragment=section";

/** The `window.open` calls that the stub of `stubWindowOpen` recorded. */
function openCalls(page: Page): Promise<unknown[][] | undefined> {
  return page.evaluate(
    () =>
      (window as typeof window & { __moklyOpenCalls?: unknown[][] })
        .__moklyOpenCalls,
  );
}

/** Replace the shell's `window.open` with a stub that records each call. */
async function stubWindowOpen(page: Page): Promise<void> {
  await page.evaluate(() => {
    const shell = window as typeof window & {
      __moklyOpenCalls?: unknown[][];
    };
    shell.__moklyOpenCalls = [];
    shell.open = (...args: Parameters<typeof window.open>) => {
      shell.__moklyOpenCalls?.push(args);
      return null;
    };
  });
}

/** Forget the calls that the stub recorded. */
async function clearOpenCalls(page: Page): Promise<void> {
  await page.evaluate(() => {
    (
      window as typeof window & { __moklyOpenCalls?: unknown[][] }
    ).__moklyOpenCalls = [];
  });
}

test("modified and explicit targets open only canonical parent-owned contexts", async ({
  page,
}) => {
  // Each popup gets a small document at its address: the check is the
  // address and the opener, not a second shell.
  const popupDocument = (url: URL) =>
    `${url.pathname}${url.search}` === DETAILS_VIEW;
  await page.context().route(popupDocument, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><link rel="icon" href="data:,"><title>Popup</title></head><body>Popup</body></html>',
    }),
  );
  // Each popup step checks that the page stays on home, so one load serves
  // every popup and both stub steps.
  await page.goto(`${suiteState.navigation.url}/view/fixture/nested/home/`);
  for (const activation of [
    {
      label: "Meta-click",
      modifiers: ["Meta"] as const,
      selector: "#mock-link",
    },
    {
      label: "Shift-click",
      modifiers: ["Shift"] as const,
      selector: "#mock-link",
    },
    {
      button: "middle" as const,
      label: "middle-click",
      selector: "#mock-link",
    },
    { label: "_blank", selector: "#blank-link" },
    { label: "named", selector: "#named-link" },
  ]) {
    await test.step(activation.label, async () => {
      const opened = page.context().waitForEvent("page");
      await page
        .frameLocator(canvasFrame("mobile"))
        .locator(activation.selector)
        .click({
          ...(activation.button ? { button: activation.button } : {}),
          ...(activation.modifiers
            ? { modifiers: [...activation.modifiers] }
            : {}),
        });
      const popup = await opened;
      await expect(popup).toHaveURL(
        /\/view\/fixture\/nested\/details\/\?fragment=section$/,
      );
      expect(await popup.evaluate(() => window.opener)).toBeNull();
      await popup.close();
      await expect(page).toHaveURL(/\/view\/fixture\/nested\/home\/$/);
    });
  }
  // The in-place steps below open the same address on the page itself.
  await page.context().unroute(popupDocument);

  await stubWindowOpen(page);
  await test.step("Control-click", async () => {
    await page
      .frameLocator(canvasFrame("mobile"))
      .locator("#mock-link")
      .dispatchEvent("click", { button: 0, ctrlKey: true });
    await expect
      .poll(() => openCalls(page))
      .toEqual([[DETAILS_VIEW, "_blank", "noopener"]]);
    await expect(page).toHaveURL(/\/view\/fixture\/nested\/home\/$/);
  });

  await test.step("named target is opened at its canonical view URL", async () => {
    await clearOpenCalls(page);
    await page
      .frameLocator(canvasFrame("mobile"))
      .locator("#named-link")
      .click();
    await expect
      .poll(() => openCalls(page))
      .toEqual([[DETAILS_VIEW, "DetailsFrame", "noopener"]]);
  });

  for (const selector of ["#top-link", "#parent-link"]) {
    await page.goto(`${suiteState.navigation.url}/view/fixture/nested/home/`);
    await page.frameLocator(canvasFrame("mobile")).locator(selector).click();
    await expectDestination(page);
  }
});

test("sandboxed direct and nested content cannot escape or invoke parent enhancement", async ({
  page,
  allowBrowserError,
}) => {
  navigationDenials(allowBrowserError, suiteState.navigation.url);
  await page.goto(`${suiteState.navigation.url}/view/fixture/nested/home/`);
  const frame = page.frameLocator(canvasFrame("mobile"));
  await expect(page.locator(canvasFrame("mobile"))).toHaveAttribute(
    "sandbox",
    "allow-same-origin",
  );
  expect(
    await frame
      .locator("body")
      .evaluate(() =>
        Boolean(
          (window as { __consumerScriptRan?: boolean }).__consumerScriptRan,
        ),
      ),
  ).toBe(false);
  const original = page.url();
  const pageCount = page.context().pages().length;
  for (const selector of [
    "#unmarked-top",
    "#unmarked-parent",
    "#unmarked-svg-top",
    "#download-top",
  ]) {
    await frame
      .locator(selector)
      .evaluate((element) =>
        element.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        ),
      );
  }
  await frame
    .locator("#top-form button")
    .evaluate((element) =>
      element.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      ),
    );

  for (const [nested, selectors] of [
    ["#srcdoc-nested", ["#srcdoc-marked", "#srcdoc-unmarked", "#srcdoc-popup"]],
    ["#local-nested", ["#local-base", "#local-marked", "#local-unmarked"]],
    ["#generated-nested", ["#return-link"]],
    ["#cross-nested", ["#cross-marked", "#cross-unmarked", "#cross-popup"]],
  ] as const) {
    const child = frame.frameLocator(nested);
    for (const selector of selectors) {
      await child
        .locator(selector)
        .evaluate((element) =>
          element.dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true }),
          ),
        );
    }
  }
  await frame.locator("#external-self").click();
  await expect
    .poll(() =>
      page
        .frames()
        .some(
          (candidate) =>
            candidate.url() === "https://cross-origin.example.test/nested.html",
        ),
    )
    .toBe(true);
  expect(page.url()).toBe(original);
  expect(page.context().pages()).toHaveLength(pageCount);
  await expect(page.locator("#mb-main h2")).toHaveText("Home");
});
