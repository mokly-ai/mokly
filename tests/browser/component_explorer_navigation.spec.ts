import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { componentExplorer } from "./component_explorer_fixture.js";
import { chooseViewport, openInspectFold } from "./workspace_actions.js";

let server: Awaited<ReturnType<typeof componentExplorer>>;
test.beforeAll(async () => {
  server = await componentExplorer();
});
test.afterAll(async () => server?.close());
test("Used by links select a real screen instance and clear stale selection on navigation", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/action/`);
  const usage = await openInspectFold(page, "usage");
  await usage.getByRole("link", { name: "Home", exact: true }).first().click();
  await expect(page).toHaveURL(
    /view\/home\/\?viewport=mobile&scheme=light&instance=[a-f0-9]{64}/,
  );
  // The link's instance is selected on the frame of its viewport and
  // scheme, and Inspect's Selection names its component and its props.
  const selection = page.locator('[data-inspect-section="selection"]');
  await expect(selection).toContainText("Action");
  await expect(selection).toContainText("Slot action");
  await expect(
    page.locator(
      '.mbk-canvas-frame[data-selected] iframe[data-workspace-frame="mobile"]',
    ),
  ).toHaveCount(1);
  const components = await openInspectFold(page, "components");
  await expect(
    components.locator('[aria-pressed="true"][data-instance-key]'),
  ).toHaveCount(1);
});

test("nested selection and frame Escape preserve focus and consumer markup", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/home/`);
  await chooseViewport(page, "desktop");
  const highlight = page.getByRole("switch", {
    name: "Highlight components",
    exact: true,
  });
  await expect(highlight).toBeEnabled();
  const frame = page.frameLocator('[data-workspace-frame="desktop"]');
  const html = await frame.locator("body").innerHTML();
  const components = await openInspectFold(page, "components");
  await page.getByText("1 nested instance", { exact: true }).click();
  // Opening a nested list selects its first instance, as a click does.
  await expect(
    components.locator('[aria-pressed="true"][data-instance-key]'),
  ).toHaveCount(1);
  await expect(page.getByRole("img", { name: / selected, / })).toHaveCount(1);
  // Escape in the frame ends Highlight components and returns focus to the
  // switch, and the frame's markup stays the consumer's own.
  await highlight.click();
  await expect(page.locator(".mbk-highlight-layer").first()).toBeVisible();
  await frame.getByRole("button", { name: "Inside", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
  await expect(highlight).toBeFocused();
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
  // The variant's page opens its parent's variant set; the Disabled row's
  // Light frame shows the saved variant.
  await expect(
    page
      .frameLocator(
        'iframe[data-workspace-variant="action/disabled"][data-workspace-color-scheme="light"]',
      )
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
