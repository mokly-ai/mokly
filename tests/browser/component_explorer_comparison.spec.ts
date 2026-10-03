import { expect, test } from "@playwright/test";

import { loadComparison, PANE_SOURCE } from "./comparison_actions.js";
import {
  startSuite,
  stopSuite,
  suiteState,
} from "./component_explorer_runtime_fixture.js";
import { chooseVariant } from "./workspace_actions.js";

test.beforeAll(startSuite);

test.afterAll(stopSuite);

test("component comparisons follow changed variants while added variants stay current", async ({
  page,
}) => {
  await page.goto(`${suiteState.server.url}/view/components/action.html`);
  await page.getByLabel("Viewport", { exact: true }).selectOption("mobile");
  await loadComparison(page, "Overlay");
  await expect(page.locator("[data-diff-stage] iframe")).toHaveCount(2);
  await expect(
    page.locator("[data-diff-stage] [data-workspace-evidence]"),
  ).toHaveCount(0);
  await expect(
    page.locator("[data-diff-stage] .mbk-comparison-evidence"),
  ).toHaveCount(0);
  await expect(page.locator("[data-workspace-evidence]")).toHaveCount(1);
  await expect(page.locator(".mbk-comparison-evidence")).toHaveCount(1);
  await expect(
    page.locator(
      '[data-inspector-panel="details"] [data-workspace-evidence].mbk-comparison-evidence',
    ),
  ).toHaveCount(1);
  await expect(page.locator('[data-inspector-panel="details"]')).toContainText(
    "Rendered content changed.",
  );
  await expect(
    page.getByRole("button", { name: "Highlight components", exact: true }),
  ).toBeDisabled();
  await chooseVariant(page, "Disabled");
  await expect(page.locator("[data-diff-stage] iframe").last()).toHaveAttribute(
    PANE_SOURCE,
    /disabled\.mobile\.html$/,
  );
  await page.getByRole("button", { name: "Current", exact: true }).click();
  await expect(
    page
      .frameLocator('[data-workspace-frame="mobile"]')
      .getByRole("button", { name: "Continue" }),
  ).toBeDisabled();
  await chooseVariant(page, "New");
  await expect(page.locator("[data-workspace-variant-status]")).toHaveText(
    "New · Added",
  );
  await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
  await expect(
    page
      .frameLocator('[data-workspace-frame="mobile"]')
      .getByRole("button", { name: "New", exact: true }),
  ).toBeVisible();
});

test("Used by links select a real screen instance and clear stale selection on navigation", async ({
  page,
}) => {
  await page.goto(`${suiteState.server.url}/view/components/action.html`);
  await page.getByRole("tab", { name: "Usage", exact: true }).click();
  await page
    .getByRole("tabpanel", { name: "Usage", exact: true })
    .getByRole("link", { name: "Home", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(
    /screens\/home\.html\?viewport=mobile&scheme=light&instance=[a-f0-9]{64}/,
  );
  await expect(
    page.getByRole("tab", { name: "Props", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("tabpanel", { name: "Props", exact: true }),
  ).toContainText("Action");
  await expect(
    page.getByRole("tabpanel", { name: "Props", exact: true }),
  ).toContainText("Slot action");
  const selected = page.locator(
    '[data-inspector-panel="components"] [aria-pressed="true"][data-instance-key]',
  );
  await expect(selected).toHaveCount(1);
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Details", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(selected).toHaveCount(1);
  await page.getByRole("button", { name: "Close inspector" }).click();
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(
    0,
  );
  await expect(selected).toHaveCount(1);
  await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
    "mobile",
  );
});

test("nested selection and frame Escape preserve focus and consumer markup", async ({
  page,
}) => {
  await page.goto(`${suiteState.server.url}/view/screens/home.html`);
  await page.getByLabel("Viewport", { exact: true }).selectOption("desktop");
  await expect(
    page.getByRole("button", { name: "Highlight components", exact: true }),
  ).toBeEnabled();
  const frame = page.frameLocator('[data-workspace-frame="desktop"]');
  const html = await frame.locator("body").innerHTML();
  await page.getByRole("tab", { name: "Components", exact: true }).click();
  await page.getByText("1 nested instances", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Highlight components", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator(
      '[data-inspector-panel="components"] [aria-pressed="true"][data-instance-key]',
    ),
  ).toHaveCount(1);
  await expect(page.locator(".mbk-highlight-label")).toHaveCount(1);
  await frame.getByRole("button", { name: "Inside", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Highlight components", exact: true }),
  ).toBeFocused();
  expect(await frame.locator("body").innerHTML()).toBe(html);
});
