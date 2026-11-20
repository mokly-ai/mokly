import { expect, test } from "@playwright/test";

import {
  EXTERNAL_LINKS,
  GET_STARTED_PATH,
  SITE_PATHS,
} from "../../src/navigation.js";
import { settings } from "../../src/settings.js";

import { BREAKPOINT } from "./routes.js";

/** The approved hero lead, which the page description repeats. */
const LEAD =
  "Prevent AI slop and accidental clobbers, by codifying your design and forcing agents to align their implementation with it.";

test("the hero carries only its heading and lead", async ({ page }) => {
  await page.goto(SITE_PATHS.home);
  await expect(page.locator(".site-hero").locator("h1, p")).toHaveText([
    "Mockup your entire app.",
    LEAD,
  ]);
});

test("the home description repeats the hero lead", async ({ page }) => {
  await page.goto(SITE_PATHS.home);
  for (const selector of [
    'meta[name="description"]',
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
  ])
    await expect(page.locator(selector)).toHaveAttribute("content", LEAD);
});

test("Get started opens the Install guide", async ({ page }) => {
  await page.goto(SITE_PATHS.home);
  const actions = page
    .locator(".site-actions")
    .getByRole("link", { name: "Get started" });
  await expect(actions).toHaveCount(2);
  for (const action of await actions.all()) {
    await expect(action).toHaveAttribute("href", GET_STARTED_PATH);
  }
  await actions.first().click();
  await expect(page).toHaveURL(new RegExp(`${GET_STARTED_PATH}$`));
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toHaveText("Install");
});

test("View on GitHub opens the open-source repository", async ({ page }) => {
  await page.goto(SITE_PATHS.home);
  const actions = page
    .locator(".site-actions")
    .getByRole("link", { name: "View on GitHub" });
  await expect(actions).toHaveCount(2);
  for (const action of await actions.all()) {
    await expect(action).toHaveAttribute("href", EXTERNAL_LINKS.github);
  }
});

test("the stage frames Project created from the dogfood catalogue", async ({
  page,
}, info) => {
  const desktop = (info.project.use.viewport?.width ?? 0) >= BREAKPOINT;
  await page.goto(SITE_PATHS.home);
  const figure = page.locator(".site-frame");
  await expect(figure).toContainText(
    `Mokly Cloud · ${settings.stagePublication}`,
  );
  await expect(figure.getByText("Ready for review")).toBeVisible();
  await expect(figure.locator(".site-idchip")).toHaveText(
    "#product/account/project-created",
  );
  await expect(figure.locator(".site-crumbs")).toContainText("Catalogue home");
  await expect(figure.locator(".site-frame-foot")).toContainText(
    "Project created",
  );
  await expect(figure.locator(".site-tree")).toBeVisible({ visible: desktop });

  const frame = page.locator("iframe.site-stage-screen:visible");
  await expect(frame).toHaveCount(1);
  await expect(frame).toHaveAttribute(
    "src",
    new RegExp(`/stage/project-created\\.${desktop ? "desktop" : "mobile"}`),
  );
  await expect(frame).toHaveAttribute("sandbox", "");
  await expect(frame).toHaveAttribute(
    "title",
    "Project created from the Mokly catalogue",
  );
  const document = page.frameLocator("iframe.site-stage-screen:visible");
  await expect(document.locator("h1")).toHaveText("Mokly Cloud is ready");
});

test("the stage shows the document matching the current scheme", async ({
  page,
}, info) => {
  await page.goto(SITE_PATHS.home);
  const dark = info.project.use.colorScheme === "dark";
  await expect(
    page.locator("iframe.site-stage-screen:visible"),
  ).toHaveAttribute("src", dark ? /\.dark\.html$/ : /(?<!\.dark)\.html$/);
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
