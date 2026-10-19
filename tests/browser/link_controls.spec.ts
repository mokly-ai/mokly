import { expect } from "@playwright/test";

import { ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS } from "../helpers/fixture_timing.js";

import { test } from "./browser_test.js";
import { documentFavicon } from "./document_error_allowance.js";
import { startLinkControlFixture } from "./link_controls_fixture.js";

let controls: Awaited<ReturnType<typeof startLinkControlFixture>>;

test.beforeAll(async () => {
  test.setTimeout(ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS);
  controls = await startLinkControlFixture();
});
test.afterAll(async () => {
  await controls?.close();
});

for (const viewport of ["mobile", "desktop"]) {
  test(`real Firna ${viewport} controls retain styling and navigate in Browse`, async ({
    page,
  }) => {
    await page.goto(`${controls.url}/view/home/`);
    const frame = page.frameLocator(`.mbk-frame-${viewport} iframe`);
    const link = frame.getByTestId("continue");
    await expect(link).toHaveJSProperty("tagName", "A");
    await expect(link).toHaveAttribute(
      "href",
      `../details/index.${viewport}.html`,
    );
    const styles = await frame.locator("body").evaluate((body) => {
      const read = (id: string) => {
        const element = body.querySelector(`[data-testid="${id}"]`)!;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          background: style.backgroundColor,
          radius: style.borderRadius,
          display: style.display,
          width: rect.width,
          height: rect.height,
          labelColor: getComputedStyle(
            [...element.querySelectorAll("*")].find(
              (child) =>
                child.childElementCount === 0 &&
                child.textContent === "Continue",
            )!,
          ).color,
        };
      };
      return {
        link: read("continue"),
        reference: read("reference"),
        blockLink: read("block-continue"),
        blockReference: read("block-reference"),
      };
    });
    expect(styles.link).toEqual(styles.reference);
    expect(styles.blockLink).toEqual(styles.blockReference);
    await page.screenshot({
      path: `.context/link-control-${viewport}.png`,
      fullPage: true,
    });
    expect(
      await frame
        .locator("body")
        .evaluate(() => "__consumerScriptRan" in window),
    ).toBe(false);
    await link.click();
    await expect(page).toHaveURL(/\/view\/details\/$/);
  });
}

test("child links provide keyboard focus and activation despite component outline resets", async ({
  page,
}) => {
  await page.goto(`${controls.url}/view/home/`);
  const frame = page.frameLocator(".mbk-frame-mobile iframe");
  const link = frame.locator("#outline-reset");
  await frame.getByTestId("continue").focus();
  await page.keyboard.press("Tab");
  await link.focus();
  await expect(link).toBeFocused();
  await expect(link).toHaveCSS("outline-style", "solid");
  await expect(link).toHaveCSS("outline-width", "2px");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/view\/details\/$/);
});

test("disabled, busy, and handler-less Firna controls stay inactive", async ({
  page,
}) => {
  await page.goto(`${controls.url}/view/home/`);
  const frame = page.frameLocator(".mbk-frame-mobile iframe");
  for (const id of ["disabled", "busy", "no-handler"]) {
    const button = frame.getByTestId(id);
    await expect(button).not.toHaveAttribute("href");
    await expect(button).not.toHaveAttribute("data-mokly-link");
    await button.dispatchEvent("click");
  }
  await expect(page).toHaveURL(/\/view\/home\/$/);
});

test("adapted controls navigate from use-case frames", async ({ page }) => {
  await page.goto(`${controls.url}/view/tour/`);
  await page
    .frameLocator(".mbk-flow-screen iframe")
    .first()
    .getByTestId("continue")
    .click();
  await expect(page).toHaveURL(/\/view\/details\/$/);
});

test("rendered controls remain native links in direct documents", async ({
  page,
  allowBrowserError,
}) => {
  documentFavicon(allowBrowserError, controls.url);
  await page.goto(
    `${controls.url}/static/mokly-generated/home/index.mobile.html`,
  );
  await page.getByTestId("continue").click();
  await expect(page).toHaveURL(/\/details\/index\.mobile\.html$/);
});
