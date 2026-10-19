import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { documentFavicon } from "./document_error_allowance.js";
import {
  chooseScheme,
  chooseViewport,
  expectFrameSource,
} from "./workspace_actions.js";

test.beforeEach(({ allowBrowserError, baseURL }) =>
  documentFavicon(allowBrowserError, baseURL!),
);

for (const viewport of ["mobile", "desktop"] as const)
  for (const scheme of ["light", "dark"] as const)
    test(`${viewport}/${scheme}: native team links retain screen axes and reach pages and documents`, async ({
      page,
    }) => {
      const suffix = `index.${viewport}${scheme === "dark" ? ".dark" : ""}.html`;
      const document = (entry: string) =>
        `/static/mokly-generated/example/team/${entry}/${suffix}`;
      const roles = new RegExp(
        `/example/team/member-roles/index${scheme === "dark" ? "\\.dark" : ""}\\.html$`,
        "u",
      );
      await page.goto(document("members"));
      await page
        .getByRole("link", { name: "Invite teammate", exact: true })
        .click();
      await expect(page).toHaveURL(
        new RegExp(document("invite").replaceAll(".", "\\.") + "$", "u"),
      );
      const send = page.getByRole("link", {
        name: "Send invitation",
        exact: true,
      });
      await expect(send).toHaveAttribute("data-mokly-link-control", "button");
      await send.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(
        new RegExp(
          document("members/invited").replaceAll(".", "\\.") + "$",
          "u",
        ),
      );
      await expect(page.getByRole("status")).toHaveText(
        "Invitation sent to sam@fernhill.example.",
      );
      await page
        .getByRole("link", { name: "Invite teammate", exact: true })
        .click();
      await page
        .getByRole("link", {
          name: "Preview the invitation email",
          exact: true,
        })
        .click();
      await expect(page).toHaveURL(
        /\/static\/mokly-generated\/example\/team\/invitation\/index\.html$/u,
      );
      await expect(
        page.getByRole("heading", {
          name: "Maya Chen invited you to Fernhill Studio",
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: "Accept invitation", exact: true })
        .click();
      await expect(page).toHaveURL(
        /\/example\/team\/members\/index\.desktop\.html$/u,
      );
      await expect(
        page.getByRole("heading", { name: "Team", exact: true }),
      ).toBeVisible();
      await page.goto(document("invite"));
      await page
        .getByRole("link", { name: "Read about roles", exact: true })
        .click();
      await expect(page).toHaveURL(roles);
      await page.goto("/view/example/team/invite/");
      await chooseViewport(page, viewport);
      await chooseScheme(page, scheme);
      const invite = page.locator(`.mbk-frame-${viewport} iframe`);
      await expectFrameSource(
        invite,
        new RegExp(document("invite").replaceAll(".", "\\.") + "$", "u"),
      );
      await invite
        .contentFrame()
        .getByRole("link", { name: "Read about roles", exact: true })
        .click();
      await expect(page).toHaveURL(/\/view\/example\/team\/member-roles\/$/u);
      await expectFrameSource(page.locator(".mbk-stage-embed iframe"), roles);
    });
