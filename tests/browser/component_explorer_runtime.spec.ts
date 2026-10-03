import { expect, test } from "@playwright/test";

import type { RunningServer } from "../../dist/server/http_types.js";

import { loadComparison } from "./comparison_actions.js";
import { createExplorerFixture } from "./component_explorer_fixture.js";
import { chooseVariant } from "./workspace_actions.js";

let server: RunningServer;
let close: () => Promise<void>;
test.beforeAll(async () => {
  const fixture = await createExplorerFixture();
  server = fixture.server;
  close = fixture.close;
});
test.afterAll(async () => close());

test("saved variants, actual contexts, inspector tabs, and history work in the real shell", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${server.url}/view/components/action.html`);
  await expect(
    page.getByRole("heading", { name: "Action", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(
      '[data-nav-disclosure="variants:components:action"] [data-route="components/action-default.html"]',
    ),
  ).toBeVisible();
  await expect(
    page.locator(
      '[data-nav-disclosure="variants:components:action"] [data-route="components/action-disabled.html"]',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Nested components" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "Details", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const mobile = page.frameLocator('[data-workspace-frame="mobile"]');
  await expect(
    mobile.getByRole("button", { name: "Continue" }),
  ).toHaveAttribute("data-viewport", "mobile");
  const variants = page.getByRole("navigation", { name: "Saved variants" });
  await expect(
    variants.getByRole("link", { name: "Default", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await variants.getByRole("link", { name: "Disabled", exact: true }).click();
  await expect(page).toHaveURL(/\/view\/components\/action-disabled\.html$/);
  await expect(
    page.getByRole("heading", { name: "Action", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy ID action-disabled" }),
  ).toHaveText("#action-disabled");
  await expect(page.locator("[data-workspace-status]")).toHaveText("Changed");
  await expect(
    page.getByLabel("Catalogue location").getByRole("link"),
  ).toHaveText("Action");
  await expect(page.locator('[data-inspector-panel="details"]')).toContainText(
    "Variant ofAction",
  );
  await expect(page.locator('[data-inspector-panel="details"]')).toContainText(
    "The saved action is unavailable.",
  );
  await expect(mobile.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.getByRole("tab", { name: "Props", exact: true }).click();
  await expect(page.locator('[data-prop-control="disabled"]')).toBeChecked();
  await expect(page.locator('[data-prop-control="disabled"]')).toBeDisabled();
  await page.getByRole("button", { name: "Close inspector" }).click();
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(
    0,
  );
  await page.goBack();
  await expect(page).toHaveURL(/\/view\/components\/action\.html$/);
  await expect(
    variants.getByRole("link", { name: "Default", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(mobile.getByRole("button", { name: "Continue" })).toBeEnabled();
  await page.goForward();
  await expect(page).toHaveURL(/\/view\/components\/action-disabled\.html$/);
  await expect(
    variants.getByRole("link", { name: "Disabled", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(errors).toEqual([]);
});

test("Changes lists changed component variants beneath their parent", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/screens/home.html`);
  await page.click('[data-filter="changed"]');

  const parent = page.locator(
    'a[data-nav-row][data-route="components/action.html"]',
  );
  await expect(parent).toHaveAttribute("data-changed-variants", "true");
  await expect(
    page.locator(
      '[data-nav-disclosure="variants:components:action"] [data-route="components/action-default.html"]',
    ),
  ).toBeVisible();
  await expect(
    page.locator(
      '[data-nav-disclosure="variants:components:action"] [data-route="components/action-disabled.html"]',
    ),
  ).toBeVisible();
});

test("a generated MockLink opens a component variant entry", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/screens/home.html`);
  await page
    .frameLocator('[data-workspace-frame="mobile"]')
    .getByRole("link", { name: "Open Disabled Action", exact: true })
    .click();

  await expect(page).toHaveURL(/\/view\/components\/action-disabled\.html$/);
  await expect(
    page.getByRole("heading", { name: "Action", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .frameLocator('[data-workspace-frame="mobile"]')
      .getByRole("button", { name: "Continue" }),
  ).toBeDisabled();
});

test("a standalone frame miss keeps navigation available for a later route", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/screens/home.html`);
  const link = page
    .frameLocator('[data-workspace-frame="mobile"]')
    .getByRole("link", { name: "Open Disabled Action", exact: true });
  await link.evaluate((element) =>
    element.setAttribute("data-mokly-link", "missing-entry"),
  );
  await link.click();
  await expect(page).toHaveURL(/\/view\/missing-entry$/);
  await expect(
    page.getByRole("heading", { name: "Item not found", exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/view\/screens\/home\.html$/);
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
});

test("Side by side stays authoritative while switching sibling variants", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/components/action-default.html`);
  await page.getByLabel("Viewport", { exact: true }).selectOption("mobile");
  await loadComparison(page, "Side by side");

  await chooseVariant(page, "Disabled");
  await expect(
    page.getByRole("button", { name: "Side by side" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: "Props", exact: true }).click();
  await expect(page.locator("[data-controls-status]")).toHaveText(
    "Comparisons show the saved variant. Return to Current to edit props.",
  );
  await expect(
    page.getByRole("button", { name: "Highlight components", exact: true }),
  ).toBeDisabled();
});
