import type { Locator } from "@playwright/test";

import { projectName } from "../../screens/account/project-name";
import { installedRepository } from "../database-fixture";
import { expect, open, test } from "../harness";
import { taggedLayoutFixture } from "../viewer/layout-fixture";
import { expectReadableBar } from "../viewer/layout-geometry";
import { publishedProject, publishedViewerReady } from "../viewer/support";

import { clearMacWindow, emulateMacWindow, partsUnderButtons } from "./regions";

/**
 * The narrowest bar that draws the full composition: the one switch width in
 * the shared `viewer-bar.css`, 72.5rem, at the default text size.
 */
const switchWidth = 72.5 * 16;

/**
 * How a variable label sits in its control: on one line, and cut with an
 * ellipsis when it does not fit. The text that the control draws is the
 * element with `dir="auto"`.
 */
function labelFit(control: Locator): Promise<string> {
  return control.evaluate((element) => {
    const label = element.querySelector<HTMLElement>("[dir=auto]");
    if (label === null) return "no label";
    const style = getComputedStyle(label);
    const height = label.getBoundingClientRect().height;
    if (height > Number.parseFloat(style.lineHeight) + 1) return "wraps";
    if (label.scrollWidth <= label.clientWidth) return "fits";
    return style.textOverflow === "ellipsis" ? "cut with an ellipsis" : "cut";
  });
}

test("at the switch width, the full bar keeps its controls apart beside the window buttons", async ({
  page,
}) => {
  const tagged = taggedLayoutFixture();
  try {
    // A long workspace name and address, so the variable labels must be cut.
    const made = await publishedProject(
      page,
      "mac-window-switch-width-with-a-long-workspace-name",
      { branch: "main", fixture: tagged.path },
    );
    await open(page, made.publicationPath + "?catalogueScreen=start");
    await publishedViewerReady(page);
    const viewer = page.locator("[data-mokly-shell]");
    const project = viewer.getByTestId("viewer-project");
    const account = viewer.getByTestId("viewer-account");
    const publication = viewer.getByTestId("viewer-publication");

    // The switch is where this test puts the bar: one pixel less draws the
    // compact bar.
    await page.setViewportSize({ width: switchWidth - 1, height: 900 });
    await expect(viewer.getByTestId("viewer-more")).toBeVisible();
    await page.setViewportSize({ width: switchWidth, height: 900 });
    await expect(viewer.getByTestId("viewer-history")).toBeVisible();
    await expect(project).toHaveAccessibleName(
      `${made.workspaceName} / ${projectName(installedRepository)}`,
    );
    await expect(account).toHaveAccessibleName(made.email);

    // The buttons take the start of the bar, or its end in a right-to-left
    // locale, so one slot or the other has less room.
    for (const edge of ["start", "end"] as const) {
      await emulateMacWindow(page, edge);
      const slot = page.locator(
        edge === "start" ? ".fo-package-slot-start" : ".fo-package-slot-end",
      );
      await expect
        .poll(() => partsUnderButtons(slot, edge), `clear at the ${edge}`)
        .toEqual([]);
      await expectReadableBar(viewer);
      for (const [label, control, fit] of [
        ["the project", project, "cut with an ellipsis"],
        ["the address", account, "cut with an ellipsis"],
        ["the branch", publication, "fits"],
      ] as const) {
        await expect
          .poll(() => labelFit(control), `${label}, buttons at the ${edge}`)
          .toBe(fit);
      }
      await clearMacWindow(page);
    }
  } finally {
    tagged.dispose();
  }
});
