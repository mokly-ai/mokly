import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { componentExplorer } from "./component_explorer_fixture.js";
let server: Awaited<ReturnType<typeof componentExplorer>>;
test.beforeAll(async () => {
  server = await componentExplorer();
});
test.afterAll(async () => server?.close());
test("Used by links select a real screen instance and clear stale selection on navigation", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/action/`);
  await page.getByRole("tab", { name: "Usage", exact: true }).click();
  await page
    .getByRole("tabpanel", { name: "Usage", exact: true })
    .getByRole("link", { name: "Home", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(
    /view\/home\/\?viewport=mobile&scheme=light&instance=[a-f0-9]{64}/,
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
  await page.goto(`${server.url}/view/home/`);
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

test("a generated MockLink opens a component variant entry", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/home/`);
  await page
    .frameLocator('[data-workspace-frame="mobile"]')
    .getByRole("link", { name: "Open Disabled Action", exact: true })
    .click();
  await expect(page).toHaveURL(/\/view\/action\/disabled\/$/);
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
  await page.goto(`${server.url}/view/home/`);
  const link = page
    .frameLocator('[data-workspace-frame="mobile"]')
    .getByRole("link", { name: "Open Disabled Action", exact: true });
  await link.evaluate((element) =>
    element.setAttribute("data-mokly-link", "missing-entry"),
  );
  await link.click();
  await expect(page).toHaveURL(/\/view\/missing-entry\/$/);
  await expect(
    page.getByRole("heading", { name: "Item not found", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/view\/home\/$/);
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
});
