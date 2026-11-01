import { expect } from "@playwright/test";

import { hasMarker, markPage, shellRoot } from "./browse_assertions.js";
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
      // Below 760px each step shows its mobile view in a phone frame.
      const viewport = width <= 760 ? "mobile" : "desktop";
      const elements = page.locator(".mbk-flow-screen iframe");
      await expect(elements).toHaveCount(3);
      await expect(
        page.locator(
          `.mbk-flow-screen > ${viewport === "mobile" ? ".phone-frame" : ".browser-frame"}`,
        ),
      ).toHaveCount(3);
      for (const [step, route] of [
        "members",
        "invite",
        "members/invited",
      ].entries()) {
        const element = elements.nth(step);
        await expectFrameSource(
          element,
          new RegExp(
            `/example/team/${route}/index\\.${viewport}${scheme === "dark" ? "\\.dark" : ""}\\.html$`,
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
      await expect(page.locator(shellRoot)).toHaveAttribute(
        "data-mokly-color-scheme",
        scheme,
      );
      expect(await hasMarker(page)).toBe(true);
    });

test("resizing across 760px swaps each step between its desktop and mobile view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/view/example/team/invite-teammate/");
  const elements = page.locator(".mbk-flow-screen iframe");
  const expectSteps = async (viewport: "desktop" | "mobile") => {
    await expect(
      page.locator(
        `.mbk-flow-screen > ${viewport === "mobile" ? ".phone-frame" : ".browser-frame"}`,
      ),
    ).toHaveCount(3);
    await expectFrameSource(
      elements.nth(0),
      new RegExp(`/example/team/members/index\\.${viewport}\\.html$`, "u"),
    );
  };
  await expectSteps("desktop");
  await page.setViewportSize({ width: 760, height: 900 });
  await expectSteps("mobile");
  await page.setViewportSize({ width: 761, height: 900 });
  await expectSteps("desktop");
});

test("an expanded step leaves no scrim once a narrow window shows phones", async ({
  page,
}) => {
  const scrim = /(?:^|\s)frame-expanded(?:\s|$)/u;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/view/example/team/invite-teammate/");
  await page.locator(".mbk-flow-screen .browser-expand").first().click();
  await expect(page.locator(".browser-frame.is-expanded")).toBeVisible();
  await expect(page.locator(shellRoot)).toHaveClass(scrim);
  await page.setViewportSize({ width: 760, height: 900 });
  await expect(page.locator(".mbk-flow-screen > .phone-frame")).toHaveCount(3);
  await expect(page.locator(shellRoot)).not.toHaveClass(scrim);
  // Widening again shows every step's browser frame collapsed.
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator(".mbk-flow-screen > .browser-frame")).toHaveCount(
    3,
  );
  await expect(page.locator(".browser-frame.is-expanded")).toHaveCount(0);
});
