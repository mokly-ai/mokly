import { expect, type Page } from "@playwright/test";

import { hasMarker, markPage, shellRoot } from "./browse_assertions.js";
import { test } from "./browser_test.js";
import {
  useCaseStep,
  useCaseStepFrame,
  useCaseSteps,
} from "./use_case_steps.js";
import { chooseScheme, expectFrameSource } from "./workspace_actions.js";

const TEAM_FLOW = "/view/example/team/invite-teammate/";

/** Each step of the YAML team flow: its screen's route and its link's name. */
const STEPS = [
  ["members", "Open the team, Team members screen"],
  ["invite", "Fill in the invitation, New invitation screen"],
  [
    "members/invited",
    "See the invitation, Team members, invitation sent screen",
  ],
] as const;

/** Wait until a step frame shows its screen's view of one viewport, in Light. */
async function expectStepView(
  page: Page,
  step: number,
  viewport: "desktop" | "mobile",
): Promise<void> {
  const [route] = STEPS[step - 1]!;
  await expectFrameSource(
    useCaseStepFrame(page, step),
    new RegExp(`/example/team/${route}/index\\.${viewport}\\.html$`, "u"),
  );
}

for (const width of [390, 1280])
  for (const scheme of ["light", "dark"] as const)
    test(`${width}px/${scheme}: the YAML team flow renders ordered native steps and links to their screens`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(TEAM_FLOW);
      await chooseScheme(page, scheme);
      await markPage(page);
      await expect(page.locator("#mb-main h2")).toHaveText("Invite a teammate");
      // The use case keeps its own Light frames under either appearance: a
      // desktop shows each step's Desktop view, and the compact layout
      // shows its Mobile view.
      const viewport = width < 900 ? "mobile" : "desktop";
      const first = useCaseStepFrame(page, 1);
      await expectStepView(page, 1, viewport);
      await expect(first.contentFrame().locator(".panel")).toHaveCSS(
        "background-color",
        "rgb(255, 255, 255)",
      );
      await expect(first.contentFrame().locator(".member-name")).toHaveText([
        "Maya Chen",
        "Jonas Berg",
        "Priya Nair",
      ]);
      await expect(
        useCaseStep(page, 1).getByRole("link", { name: STEPS[0][1] }),
      ).toBeVisible();
      if (viewport === "desktop") {
        // Every step stands in step order, each named by its number and
        // title, with a link that names its screen.
        await expect(useCaseSteps(page)).toHaveCount(3);
        for (const [index, [, link]] of STEPS.entries()) {
          await expect(
            useCaseSteps(page).nth(index).getByRole("link"),
          ).toHaveAccessibleName(link);
          await expectStepView(page, index + 1, viewport);
        }
        await expect(
          useCaseStepFrame(page, 2)
            .contentFrame()
            .getByRole("heading", { name: "Invite a teammate", exact: true }),
        ).toBeVisible();
        await expect(
          useCaseStepFrame(page, 3).contentFrame().getByRole("status"),
        ).toHaveText("Invitation sent to sam@fernhill.example.");
        await expect(
          useCaseStepFrame(page, 3).contentFrame().locator(".member-name"),
        ).toHaveCount(4);
        await page.getByRole("link", { name: STEPS[2][1] }).click();
        await expect(page).toHaveURL(
          /\/view\/example\/team\/members\/invited\/$/u,
        );
        expect(await hasMarker(page)).toBe(true);
        await page.goBack();
        await expect(useCaseSteps(page)).toHaveCount(3);
      }
      await useCaseStepFrame(page, 1)
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

test("each step shows its Desktop view from the layout breakpoint up, and its Mobile view below it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(TEAM_FLOW);
  await expectStepView(page, 1, "desktop");
  await expect(useCaseStep(page, 1)).toContainText("1280 × 800");
  await page.setViewportSize({ width: 899, height: 900 });
  await expectStepView(page, 1, "mobile");
  await expect(useCaseStep(page, 1)).toContainText("390 × 844");
  await page.setViewportSize({ width: 900, height: 900 });
  await expectStepView(page, 1, "desktop");
});
