import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import {
  canvasFrame,
  chooseScheme,
  chooseVariant,
  chooseViewport,
} from "./workspace_actions.js";

for (const scheme of ["light", "dark"] as const)
  test(`${scheme}: the native workspace panel keeps fallback and named saved slots separate`, async ({
    page,
  }) => {
    await page.goto("/view/example/components/workspace-panel/");
    await chooseViewport(page, "mobile");
    await chooseScheme(page, scheme);
    // On the canvas a component's row shows its desktop view in each scheme.
    const row = (path: string) =>
      page.frameLocator(
        `${canvasFrame("desktop", scheme)}[data-workspace-variant="example/components/workspace-panel${path}"]`,
      );
    let frame = row("");
    await expect(frame.locator(".panel-heading")).toHaveText(
      "Pending invitations",
    );
    await expect(frame.locator(".panel-count")).toHaveText("0");
    await expect(frame.locator(".panel-body")).toHaveText(
      "New items appear here.",
    );
    await expect(frame.locator(".panel-actions")).toBeHidden();
    // A row of Variants selects its Light frame on the canvas.
    await chooseVariant(page, "Workspace panel with actions");
    await expect(
      page.locator('[data-inspect-section="variants"] [data-checked]'),
    ).toHaveText("Workspace panel with actions");
    frame = row("/with-actions");
    await expect(frame.locator(".panel-count")).toHaveText("1");
    await expect(frame.locator(".panel-body")).toHaveText(
      "sam@fernhill.example is invited as a member.",
    );
    await expect(frame.getByText("New items appear here.")).toHaveCount(0);
    const action = frame
      .locator(".panel-actions")
      .getByRole("link", { name: "Invite teammate", exact: true });
    await expect(action).toHaveCount(1);
    await expect(frame.locator("slot, .panel-body .button")).toHaveCount(0);
    await expect(frame.locator(".panel")).toHaveCSS(
      "background-color",
      scheme === "dark" ? "rgb(27, 32, 29)" : "rgb(255, 255, 255)",
    );
    await action.click();
    await expect(page).toHaveURL(/\/view\/example\/team\/invite\/$/u);
    // The screen shows its Mobile frame of the scheme beside its Desktop
    // frame.
    await expect(
      page
        .frameLocator(canvasFrame("mobile", scheme))
        .getByRole("heading", { name: "Invite a teammate", exact: true }),
    ).toBeVisible();
  });
