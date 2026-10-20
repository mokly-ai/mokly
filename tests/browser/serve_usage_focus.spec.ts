/**
 * Usage in Serve under the live evidence contract: a Changes completion that
 * adds the Affected section keeps the matching Used by link element, so a
 * keyboard interaction with that unchanged link goes on.
 */

import { expect } from "@playwright/test";

import { test } from "./serve_comparison_test.js";
import { expectFrameLoaded } from "./workspace_actions.js";

test("a Changes completion keeps keyboard focus on an unchanged Usage link", async ({
  page,
  changes,
}) => {
  const card = changes.paths.component;
  const consumer = changes.paths.consumer;
  const status = page.locator("[data-workspace-status]");
  await page.goto(`/view/${card}/`);
  await expect(status).toHaveText("Changed");
  // At the head commit nothing changed, so Usage lists only Used by.
  await changes.moveBase("head");
  await expect(status).toHaveText("Unmodified");
  await page.getByRole("tab", { name: "Usage", exact: true }).click();
  const usage = page.getByRole("tabpanel", { name: "Usage", exact: true });
  await expect(usage.locator('[data-usage-section="used-by"]')).toContainText(
    "Consumer screen",
  );
  await expect(usage).not.toContainText("Affected screens and components");
  const link = usage
    .getByRole("link", { name: "Consumer screen", exact: true })
    .first();
  await link.focus();
  await expect(link).toBeFocused();
  // A marker on the element proves that the update keeps the same node.
  await link.evaluate((node) => node.setAttribute("data-test-retained", ""));

  // Moving the base back publishes a completion that classifies Card again.
  await changes.moveBase("base");

  await expect(status).toHaveText("Changed");
  await expect(usage.locator('[data-usage-section="affected"]')).toContainText(
    "Consumer screen",
  );
  await expect(usage).toContainText("Affected screens and components");
  await expect(link).toBeFocused();
  await expect(link).toHaveAttribute("data-test-retained", "");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    new RegExp(
      `/view/${consumer}/\\?viewport=mobile&scheme=light&instance=[a-f0-9]{64}$`,
      "u",
    ),
  );
  await expectFrameLoaded(
    page.locator('[data-workspace-frame="mobile"]'),
    /\/screens\/consumer\/index\.mobile\.html/u,
  );
});
