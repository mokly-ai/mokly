import { expect } from "@playwright/test";

import { staticRequests } from "./static_delivery_assertions.js";
import { test } from "./static_test.js";
import {
  chooseScheme,
  chooseVariant,
  chooseViewport,
  expectFrameSource,
} from "./workspace_actions.js";

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: copied saved variants and instance inspection work with read-only props`, async ({
    page,
  }) => {
    const requests = staticRequests(page);
    await page.goto("/view/example/components/action/disabled/");
    await chooseViewport(page, viewport);
    await page.getByRole("tab", { name: "Props", exact: true }).click();
    const props = page.getByRole("tabpanel", { name: "Props", exact: true });
    await expect(
      props.getByRole("heading", { name: "Saved props" }),
    ).toBeVisible();
    await expect(props).toContainText(
      "Open this catalogue locally to edit props.",
    );
    await expect(props.locator("input, textarea, select")).toHaveCount(0);
    const frame = page.frameLocator(`[data-workspace-frame="${viewport}"]`);
    await expect(frame.getByRole("button").first()).toBeDisabled();
    await chooseScheme(page, "dark");
    await expectFrameSource(
      page.locator(`[data-workspace-frame="${viewport}"]`),
      new RegExp(`/disabled/index\\.${viewport}\\.dark\\.html$`),
    );
    await chooseVariant(page, "Default");
    await expect(page).toHaveURL(
      /\/view\/example\/components\/action\/default\/$/,
    );
    await expect(frame.getByRole("button").first()).toBeEnabled();
    await page.getByRole("tab", { name: "Usage", exact: true }).click();
    await page
      .getByRole("tabpanel", { name: "Usage", exact: true })
      .getByRole("link", { name: "Welcome", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(
      /\/view\/example\/screens\/welcome\/\?.*instance=/,
    );
    await expect(
      page.getByRole("tabpanel", { name: "Props", exact: true }),
    ).toContainText("Action");
    const highlight = page.getByRole("button", {
      name: "Highlight components",
      exact: true,
    });
    await expect(highlight).toBeEnabled();
    await highlight.click();
    await expect(page.locator(".mbk-highlight-layer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
    await page
      .getByRole("link", { name: "Open component", exact: true })
      .click();
    await expect(page.locator("#mb-main h2")).toHaveText("Action");
    requests.assert();
  });
}
