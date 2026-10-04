import { expect, test } from "@playwright/test";

import {
  appearance,
  appearanceSelect,
  face,
  mobileFrame,
  expectSchemeSelected,
  computedStyle,
} from "./browse_assertions.js";
import { chooseScheme, expectFrameSource } from "./workspace_actions.js";

test("Appearance stays reachable at both widths", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/view/screens/example-welcome.html");
  // Narrow, the control keeps its glyph and drops only its label, so search
  // and the menu keep their room.
  await expect(page.locator(appearance)).toBeVisible();
  // The control renders every face and reveals the current one, so the word is
  // measured on the face the document is actually in.
  expect(
    await computedStyle(page, `${appearance} ${face("auto")}`, "position"),
  ).toBe("absolute");
  await expect(page.locator(".mbk-search")).toBeVisible();
  await expect(page.locator("[data-mokly-menu]")).toBeVisible();

  await chooseScheme(page, "dark");
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/example-welcome\.mobile\.dark\.html$/,
  );

  await page.setViewportSize({ height: 800, width: 1_280 });
  await expect(page.locator(appearance)).toBeVisible();
  expect(
    await computedStyle(page, `${appearance} ${face("dark")}`, "position"),
  ).toBe("static");
  // An explicit choice survives the width change, in the control and in the
  // document mark the previews follow.
  await expect(page.locator(appearanceSelect)).toHaveValue("dark");
  await expectSchemeSelected(page, "dark");
});

test("the catalogue home carries Appearance when narrow", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");
  // Home has no screen head band, so the one control has to be in the top bar.
  await expect(page.locator(".mbk-screen-head")).toHaveCount(0);
  await expect(page.locator(appearance)).toBeVisible();
  await expect(page.locator("[data-mokly-schemeswitch]")).toHaveCount(0);
});

test("ID chips copy their ID without navigating", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(text: string) {
          (window as Window & { __copiedId?: string }).__copiedId = text;
          return Promise.resolve();
        },
      },
    });
  });
  await page.goto("/view/screens/example-welcome.html");
  const url = page.url();
  const idChip = page.locator("[data-copy-id]");

  await expect(idChip).toHaveText("#example-welcome");
  await idChip.hover();
  expect(
    await idChip.evaluate((element) => getComputedStyle(element).cursor),
  ).toBe("pointer");
  await page.mouse.down();
  const pressed = await idChip.evaluate((element) => {
    const style = getComputedStyle(element);
    return { boxShadow: style.boxShadow, transform: style.transform };
  });
  expect(pressed.boxShadow).not.toBe("none");
  expect(pressed.transform).not.toBe("none");
  await page.mouse.up();

  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __copiedId?: string }).__copiedId,
      ),
    )
    .toBe("example-welcome");
  await expect(page).toHaveURL(url);
  await expect(page.locator("#mb-status")).toHaveText(
    "Copied ID example-welcome",
  );
});

test("the address pill copies its address from its copy icon", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(text: string) {
          (window as Window & { __copiedUrl?: string }).__copiedUrl = text;
          return Promise.resolve();
        },
      },
    });
  });
  await page.goto("/view/screens/example-welcome.html");
  const icon = page.locator(".browser-bar .address-copy svg");
  await expect(icon).toBeVisible();
  const box = await icon.boundingBox();
  expect(box?.width).toBe(13);
  expect(box?.height).toBe(13);

  await icon.click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __copiedUrl?: string }).__copiedUrl,
      ),
    )
    .toBe("example.test/welcome");
  await expect(page.locator(".address-copied")).toHaveText("URL copied");
});

test("the expand toggle swaps its icon while the frame is expanded", async ({
  page,
}) => {
  await page.goto("/view/screens/example-welcome.html");
  const expandIcon = page.locator(".browser-expand .i-expand svg");
  const collapseIcon = page.locator(".browser-expand .i-collapse svg");
  await expect(expandIcon).toBeVisible();
  await expect(collapseIcon).toBeHidden();
  const box = await expandIcon.boundingBox();
  expect(box?.width).toBe(13);
  expect(box?.height).toBe(13);

  await page.click(".browser-expand");
  await expect(expandIcon).toBeHidden();
  await expect(collapseIcon).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(expandIcon).toBeVisible();
  await expect(collapseIcon).toBeHidden();
});
