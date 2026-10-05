import { expect, test } from "@playwright/test";

import {
  appearance,
  appearanceSelect,
  computedStyle,
  desktopFrame,
  detailsRow,
  expectSchemeSelected,
  face,
  mobileFrame,
} from "./browse_assertions.js";
import { chooseScheme, expectFrameSource } from "./workspace_actions.js";

test("scheme selection survives progressive navigation", async ({ page }) => {
  await page.goto("/view/example/screens/welcome/");
  await chooseScheme(page, "dark");
  await page.click(detailsRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expectFrameSource(
    page.locator(mobileFrame),
    /example\/screens\/details\/index\.mobile\.dark\.html$/,
  );
  await expectFrameSource(
    page.locator(desktopFrame),
    /example\/screens\/details\/index\.desktop\.dark\.html$/,
  );
  await expectSchemeSelected(page, "dark");

  await page.goBack();
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await expectFrameSource(
    page.locator(mobileFrame),
    /example\/screens\/welcome\/index\.mobile\.dark\.html$/,
  );
  await expectSchemeSelected(page, "dark");

  await page.goForward();
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expectFrameSource(
    page.locator(mobileFrame),
    /example\/screens\/details\/index\.mobile\.dark\.html$/,
  );
});

test("Appearance stays reachable at both widths", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/view/example/screens/welcome/");
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
    /example\/screens\/welcome\/index\.mobile\.dark\.html$/,
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
