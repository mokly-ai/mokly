import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { chooseScheme, expectFrameSource } from "./workspace_actions.js";

for (const width of [390, 1280]) {
  test(`${width}px: the invitation page keeps its authored document in both appearances`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/view/example/team/invitation/");
    await expect(page.locator("#mb-main h2")).toHaveText("Invitation email");
    const element = page.locator(".mbk-stage-embed iframe");
    const frame = element.contentFrame();
    await expect(element).toHaveCount(1);
    await expect(page.getByLabel("Viewport", { exact: true })).toHaveCount(0);
    for (const scheme of ["light", "dark"] as const) {
      await chooseScheme(page, scheme);
      await expectFrameSource(
        element,
        /\/example\/team\/invitation\/index\.html$/u,
      );
      await expect(
        frame.getByRole("heading", {
          name: "Maya Chen invited you to Fernhill Studio",
          exact: true,
        }),
      ).toBeVisible();
      await expect(frame.locator(".invitation-note")).toHaveText(
        "This invitation is valid for 7 days.",
      );
      await expect(frame.locator("body")).toHaveCSS(
        "background-color",
        "rgb(247, 247, 243)",
      );
      await expect(frame.locator(".invitation")).toHaveCSS(
        "background-color",
        "rgb(255, 255, 255)",
      );
      await expect(frame.locator('link[href*="workspace-dark"]')).toHaveCount(
        0,
      );
    }
    await frame
      .getByRole("link", { name: "Accept invitation", exact: true })
      .click();
    await expect(page).toHaveURL(/\/view\/example\/team\/members\/$/u);
    await expect(page.locator("#mb-main h2")).toHaveText("Team members");
  });

  test(`${width}px: team role documentation keeps its table, anchor, and native screen links`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/view/example/team/member-roles/?fragment=choose-a-role");
    await expect(page.locator("#mb-main h2")).toHaveText("Member roles");
    const element = page.locator(".mbk-stage-embed iframe");
    const frame = element.contentFrame();
    for (const scheme of ["light", "dark"] as const) {
      await chooseScheme(page, scheme);
      await expectFrameSource(
        element,
        new RegExp(
          `/member-roles/index${scheme === "dark" ? "\\.dark" : ""}\\.html#choose-a-role$`,
          "u",
        ),
      );
      await expect(frame.locator("#choose-a-role")).toBeVisible();
      await expect(frame.locator("table tbody tr td:first-child")).toHaveText([
        "Owner",
        "Admin",
        "Member",
      ]);
    }
    await frame
      .getByRole("link", { name: "Invite a teammate", exact: true })
      .click();
    await expect(page).toHaveURL(/\/view\/example\/team\/invite\/$/u);
    await expect(page.locator("#mb-main h2")).toHaveText("New invitation");
    await expect(page.locator("body")).toHaveAttribute(
      "data-mokly-color-scheme",
      "dark",
    );
  });
}
