import { expect, test } from "@playwright/test";

import { expectDestination } from "./navigation_destination.js";
import {
  startNavigationFixture,
  type NavigationFixture,
} from "./navigation_fixture.js";

let navigation: NavigationFixture;

test.beforeAll(async () => {
  navigation = await startNavigationFixture();
});

test.afterAll(async () => {
  await navigation.close();
});

test.beforeEach(async ({ page }) => {
  await page.route("https://cross-origin.example.test/nested.html", (route) =>
    route.fulfill({
      body: '<a data-mokly-link="details#section" href="/details" id="cross-marked" target="_top">Marked</a><a href="#ordinary" id="cross-unmarked" target="_top">Ordinary</a><a href="#popup" id="cross-popup" target="_blank">Popup</a><script>parent.__crossScriptRan=true</script>',
      contentType: "text/html",
    }),
  );
});

test("modified and explicit targets open only canonical parent-owned contexts", async ({
  page,
}) => {
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
      await page.goto(`${navigation.url}/view/fixture/nested/home/`);
      const opened = page.context().waitForEvent("page");
      await page
        .frameLocator(".mbk-frame-mobile iframe")
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

  await test.step("Control-click", async () => {
    await page.goto(`${navigation.url}/view/fixture/nested/home/`);
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
    await page
      .frameLocator(".mbk-frame-mobile iframe")
      .locator("#mock-link")
      .dispatchEvent("click", { button: 0, ctrlKey: true });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { __moklyOpenCalls?: unknown[][] })
              .__moklyOpenCalls,
        ),
      )
      .toEqual([
        [
          "/view/fixture/nested/details/?fragment=section",
          "_blank",
          "noopener",
        ],
      ]);
    await expect(page).toHaveURL(/\/view\/fixture\/nested\/home\/$/);
  });

  await test.step("named target is opened at its canonical view URL", async () => {
    await page.goto(`${navigation.url}/view/fixture/nested/home/`);
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
    await page
      .frameLocator(".mbk-frame-mobile iframe")
      .locator("#named-link")
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { __moklyOpenCalls?: unknown[][] })
              .__moklyOpenCalls,
        ),
      )
      .toEqual([
        [
          "/view/fixture/nested/details/?fragment=section",
          "DetailsFrame",
          "noopener",
        ],
      ]);
  });

  for (const selector of ["#top-link", "#parent-link"]) {
    await page.goto(`${navigation.url}/view/fixture/nested/home/`);
    await page
      .frameLocator(".mbk-frame-mobile iframe")
      .locator(selector)
      .click();
    await expectDestination(page);
  }
});

test("sandboxed direct and nested content cannot escape or invoke parent enhancement", async ({
  page,
}) => {
  await page.goto(`${navigation.url}/view/fixture/nested/home/`);
  const frame = page.frameLocator(".mbk-frame-mobile iframe");
  await expect(page.locator(".mbk-frame-mobile iframe")).toHaveAttribute(
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
  await page.waitForTimeout(200);
  expect(page.url()).toBe(original);
  expect(page.context().pages()).toHaveLength(pageCount);
  await expect(page.locator("#mb-main h2")).toHaveText("Home");
});
