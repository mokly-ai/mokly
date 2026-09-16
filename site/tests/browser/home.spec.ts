import { expect, test } from "@playwright/test";

import { SITE_PATHS } from "../../src/navigation.js";
import { settings } from "../../src/settings.js";

import { BREAKPOINT, SIGN_UP } from "./routes.js";

test("Get started leaves for the application sign-up", async ({ page }) => {
  await page.goto(SITE_PATHS.home);
  const actions = page.getByRole("link", { name: "Get started" });
  await expect(actions.first()).toHaveAttribute("href", SIGN_UP);
  for (const action of await actions.all()) {
    await expect(action).toHaveAttribute("href", SIGN_UP);
  }
});

test("Read the docs opens the documentation", async ({ page }) => {
  await page.goto(SITE_PATHS.home);
  const action = page.getByRole("link", { name: "Read the docs" }).first();
  await expect(action).toHaveAttribute("href", SITE_PATHS.docs);
  await action.click();
  await expect(page).toHaveURL(new RegExp(`${SITE_PATHS.docs}$`));
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toHaveText("Getting started");
});

test("the stage frames the Welcome screen of the example catalogue", async ({
  page,
}, info) => {
  const desktop = (info.project.use.viewport?.width ?? 0) >= BREAKPOINT;
  await page.goto(SITE_PATHS.home);
  const figure = page.locator(".site-frame");
  await expect(figure).toContainText(`Pull request #${settings.stagePr}`);
  await expect(figure.getByText("Ready for review")).toBeVisible();
  await expect(figure.locator(".site-idchip")).toHaveText("#welcome");
  await expect(figure.locator(".site-crumbs")).toContainText("Catalogue home");
  await expect(figure.locator(".site-frame-foot")).toContainText("Welcome");
  await expect(figure.locator(".site-tree")).toBeVisible({ visible: desktop });

  const frame = page.locator("iframe.site-stage-frame:visible");
  await expect(frame).toHaveCount(1);
  await expect(frame).toHaveAttribute(
    "src",
    new RegExp(`/stage/welcome\\.${desktop ? "desktop" : "mobile"}`),
  );
  await expect(frame).toHaveAttribute("sandbox", "");
  await expect(frame).toHaveAttribute(
    "title",
    "Welcome from the Mokly catalogue",
  );
  const document = page.frameLocator("iframe.site-stage-frame:visible");
  await expect(document.locator("h1")).toHaveText("Welcome to Mokly");
});

test("the stage shows the document matching the current scheme", async ({
  page,
}, info) => {
  await page.goto(SITE_PATHS.home);
  const dark = info.project.use.colorScheme === "dark";
  await expect(page.locator("iframe.site-stage-frame:visible")).toHaveAttribute(
    "src",
    dark ? /\.dark\.html$/ : /(?<!\.dark)\.html$/,
  );
});

test("the numbered modules and the closing steps are published in order", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.home);
  await expect(page.locator(".site-module-eyebrow")).toHaveText([
    "01BROWSE",
    "02REVIEW",
    "03EDIT",
  ]);
  await expect(page.locator(".site-module h3")).toHaveText([
    "See every branch as screens.",
    "Comment on the screen itself.",
    "Ask for the change beside the screen.",
  ]);
  await expect(page.locator(".site-step h3")).toHaveText([
    "Shape the next screen.",
    "Publish the branch.",
    "Build from a shared decision.",
  ]);
});
