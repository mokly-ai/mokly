import { expect } from "@playwright/test";

import { shellRoot } from "./browse_assertions.js";
import { test } from "./browser_test.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

for (const viewport of ["mobile", "desktop"] as const)
  for (const scheme of ["light", "dark"] as const)
    test(`${viewport}/${scheme}: native team screens compose slots and follow the invitation variant`, async ({
      page,
    }) => {
      await page.goto("/view/example/team/members/");
      await chooseViewport(page, viewport);
      await chooseScheme(page, scheme);
      const frame = page.frameLocator(`.mbk-frame-${viewport} iframe`);
      await expect(
        frame.getByRole("heading", { name: "Team", exact: true }),
      ).toBeVisible();
      await expect(frame.locator(".member-name")).toHaveText([
        "Maya Chen",
        "Jonas Berg",
        "Priya Nair",
      ]);
      await expect(frame.locator(".member-status")).toHaveCount(0);
      await expect(frame.locator(".panel-body .member-list")).toHaveCount(1);
      await expect(frame.locator(".panel-heading")).toHaveText("Members");
      await expect(frame.locator(".panel-count")).toHaveText("3");
      await expect(
        frame.locator("workspace-panel, workspace-member, workspace-nav, slot"),
      ).toHaveCount(0);
      await expect(frame.locator(".side-nav")).toHaveCount(
        viewport === "desktop" ? 1 : 0,
      );
      await expect(frame.locator(".top-bar")).toHaveCount(
        viewport === "mobile" ? 1 : 0,
      );
      await expect(frame.locator(".panel")).toHaveCSS(
        "background-color",
        scheme === "dark" ? "rgb(27, 32, 29)" : "rgb(255, 255, 255)",
      );
      const invite = frame
        .locator(".panel-actions")
        .getByRole("link", { name: "Invite teammate", exact: true });
      await expect(invite).toHaveCount(1);
      await expect(frame.locator(".panel-body .panel-actions")).toHaveCount(0);
      await invite.click();
      await expect(page).toHaveURL(/\/view\/example\/team\/invite\/$/u);
      await expect(
        frame.getByRole("heading", { name: "Invite a teammate", exact: true }),
      ).toBeVisible();
      await expect(frame.locator(".app-head p")).toHaveText(
        "Fernhill Studio has 2 open seats on the Team plan.",
      );
      await expect(frame.locator(".panel-body form")).toHaveCount(1);
      await expect(frame.locator(".aside")).toHaveCount(
        viewport === "desktop" ? 1 : 0,
      );
      await expect(frame.locator(".help")).toHaveCount(
        viewport === "mobile" ? 1 : 0,
      );
      await frame
        .getByRole("textbox", { name: "Name", exact: true })
        .fill("Sam Okafor");
      await frame
        .getByRole("textbox", { name: "Email address", exact: true })
        .fill("sam@fernhill.example");
      await frame
        .getByRole("combobox", { name: "Role", exact: true })
        .selectOption("Admin");
      await expect(
        frame.getByRole("combobox", { name: "Role", exact: true }),
      ).toHaveValue("Admin");
      const send = frame
        .locator(".panel-actions")
        .getByRole("link", { name: "Send invitation", exact: true });
      await expect(send).toHaveAttribute("data-mokly-link-control", "button");
      await send.click();
      await expect(page).toHaveURL(
        /\/view\/example\/team\/members\/invited\/$/u,
      );
      await expect(frame.getByRole("status")).toHaveText(
        "Invitation sent to sam@fernhill.example.",
      );
      await expect(frame.locator(".member-name")).toHaveText([
        "Maya Chen",
        "Jonas Berg",
        "Priya Nair",
        "Sam Okafor",
      ]);
      await expect(frame.locator(".member-status")).toHaveText("Invited");
      await expect(page.locator(shellRoot)).toHaveAttribute(
        "data-mokly-color-scheme",
        scheme,
      );
    });
