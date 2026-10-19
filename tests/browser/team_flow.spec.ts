import { expect } from "@playwright/test";

import { hasMarker, markPage } from "./browse_assertions.js";
import { test } from "./browser_test.js";
import { chooseScheme, expectFrameSource } from "./workspace_actions.js";

for (const width of [390, 1280])
  for (const scheme of ["light", "dark"] as const)
    test(`${width}px/${scheme}: the YAML team flow renders ordered native steps and links to their screens`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/view/example/team/invite-teammate/");
      await chooseScheme(page, scheme);
      await markPage(page);
      await expect(page.locator("#mb-main h2")).toHaveText("Invite a teammate");
      await expect(page.locator(".flow-step-head h3")).toHaveText([
        "Open the team",
        "Fill in the invitation",
        "See the invitation",
      ]);
      const elements = page.locator(".mbk-flow-screen iframe");
      await expect(elements).toHaveCount(3);
      for (const [step, route] of [
        "members",
        "invite",
        "members/invited",
      ].entries()) {
        const element = elements.nth(step);
        await expectFrameSource(
          element,
          new RegExp(
            `/example/team/${route}/index\\.desktop${scheme === "dark" ? "\\.dark" : ""}\\.html$`,
            "u",
          ),
        );
        await expect(element.contentFrame().locator(".panel")).toHaveCSS(
          "background-color",
          scheme === "dark" ? "rgb(27, 32, 29)" : "rgb(255, 255, 255)",
        );
      }
      await expect(
        elements.nth(0).contentFrame().locator(".member-name"),
      ).toHaveText(["Maya Chen", "Jonas Berg", "Priya Nair"]);
      await expect(
        elements
          .nth(1)
          .contentFrame()
          .getByRole("heading", { name: "Invite a teammate", exact: true }),
      ).toBeVisible();
      await expect(
        elements.nth(2).contentFrame().getByRole("status"),
      ).toHaveText("Invitation sent to sam@fernhill.example.");
      await expect(
        elements.nth(2).contentFrame().locator(".member-name"),
      ).toHaveCount(4);
      await page.locator(".flow-step-link").nth(2).click();
      await expect(page).toHaveURL(
        /\/view\/example\/team\/members\/invited\/$/u,
      );
      expect(await hasMarker(page)).toBe(true);
      await page.goBack();
      await expect(page.locator(".flow-step-head h3")).toHaveCount(3);
      await elements
        .nth(0)
        .contentFrame()
        .getByRole("link", { name: "Invite teammate", exact: true })
        .click();
      await expect(page).toHaveURL(/\/view\/example\/team\/invite\/$/u);
      await expect(page.locator("body")).toHaveAttribute(
        "data-mokly-color-scheme",
        scheme,
      );
      expect(await hasMarker(page)).toBe(true);
    });
