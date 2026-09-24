import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import { startLinkControlFixture } from "./link_controls_fixture.js";

let controls: Awaited<ReturnType<typeof startLinkControlFixture>>;

test.beforeAll(async () => {
  controls = await startLinkControlFixture();
});
test.afterAll(async () => {
  await controls?.close();
});

for (const viewport of ["mobile", "desktop"]) {
  test(`real Firna ${viewport} controls retain styling and navigate in Browse`, async ({
    page,
  }) => {
    await page.goto(`${controls.url}/view/screens/home.html`);
    const frame = page.frameLocator(`.mbk-frame-${viewport} iframe`);
    const link = frame.getByTestId("continue");
    await expect(link).toHaveJSProperty("tagName", "A");
    await expect(link).toHaveAttribute("href", `./details.${viewport}.html`);
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
    await expect(page).toHaveURL(/\/view\/screens\/details\.html$/);
  });
}

test("child links provide keyboard focus and activation despite component outline resets", async ({
  page,
}) => {
  await page.goto(`${controls.url}/view/screens/home.html`);
  const frame = page.frameLocator(".mbk-frame-mobile iframe");
  const link = frame.locator("#outline-reset");
  await frame.getByTestId("continue").focus();
  await page.keyboard.press("Tab");
  await link.focus();
  await expect(link).toBeFocused();
  await expect(link).toHaveCSS("outline-style", "solid");
  await expect(link).toHaveCSS("outline-width", "2px");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/view\/screens\/details\.html$/);
});

test("disabled, busy, and handler-less Firna controls stay inactive", async ({
  page,
}) => {
  await page.goto(`${controls.url}/view/screens/home.html`);
  const frame = page.frameLocator(".mbk-frame-mobile iframe");
  for (const id of ["disabled", "busy", "no-handler"]) {
    const button = frame.getByTestId(id);
    await expect(button).not.toHaveAttribute("href");
    await expect(button).not.toHaveAttribute("data-mokly-link");
    await button.dispatchEvent("click");
  }
  await expect(page).toHaveURL(/\/view\/screens\/home\.html$/);
});

test("adapted controls navigate from use-case frames", async ({ page }) => {
  await page.goto(`${controls.url}/view/user-flows/tour.html`);
  await page
    .frameLocator(".mbk-flow-screen iframe")
    .first()
    .getByTestId("continue")
    .click();
  await expect(page).toHaveURL(/\/view\/screens\/details\.html$/);
});

test("generated controls remain native links in standalone and Review snapshots", async ({
  page,
}) => {
  for (const root of [
    path.join(controls.fixture.mockupsDir, ".generated"),
    path.join(controls.reviewDir, "snapshots/after"),
    path.join(controls.reviewDir, "snapshots/before"),
  ]) {
    await page.goto(
      pathToFileURL(path.join(root, "screens/home.mobile.html")).href,
    );
    await page.getByTestId("continue").click();
    await expect(page).toHaveURL(/\/screens\/details\.mobile\.html$/);
  }
});
