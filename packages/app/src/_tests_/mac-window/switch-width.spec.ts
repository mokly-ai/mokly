import type { Locator, Page } from "@playwright/test";

import { projectName } from "../../screens/account/project-name";
import { publicationPathFor } from "../addresses";
import { fillPullRequest, installedRepository } from "../database-fixture";
import { expect, open, test } from "../harness";
import { publish } from "../publish";
import { taggedLayoutFixture } from "../viewer/layout-fixture";
import { expectReadableBar } from "../viewer/layout-geometry";
import { publishedProject, publishedViewerReady } from "../viewer/support";

import { clearMacWindow, emulateMacWindow, partsUnderButtons } from "./regions";
import type { WindowEdge } from "./regions";

/**
 * The narrowest bar that draws the full composition: the one switch width in
 * the shared `viewer-bar.css`, 63.875rem, at the default text size.
 */
const switchWidth = 63.875 * 16;

/** A Mac's user agent: the search's key hint names `⌘K` there. */
const macAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

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

/**
 * Open the widest centre at the switch width: a pull request's older
 * publication in its Changes view, so the pill stands beside the Changes
 * badge, GitHub and View latest, in a catalogue whose tags give the search
 * its tag picker.
 */
async function openWidestCentre(page: Page, label: string): Promise<Locator> {
  const tagged = taggedLayoutFixture();
  try {
    const made = await publishedProject(page, label, {
      branch: "main",
      fixture: tagged.path,
    });
    fillPullRequest(made.projectId, {
      number: 7,
      title: "Hold the widest centre",
      author: "octocat",
      branch: "widest",
    });
    const input = { branch: "widest", pullRequest: 7, fixture: tagged.path };
    const older = await publish(made.token, made.projectId, input);
    await publish(made.token, made.projectId, input);
    await page.setViewportSize({ width: switchWidth, height: 900 });
    const path = await publicationPathFor(page, made.projectId, older.id);
    await open(page, path + "?view=changes&catalogueScreen=start");
    await publishedViewerReady(page);
  } finally {
    tagged.dispose();
  }
  // The offer of the newer publication asks on a visibility change.
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  const viewer = page.locator("[data-mokly-shell]");
  await expect(viewer.getByTestId("view-latest")).toBeVisible();
  await expect(
    viewer.getByRole("button", { name: "Filter by tag" }),
  ).toBeVisible();
  await expect(viewer.getByTestId("viewer-history")).toBeVisible();
  return viewer;
}

/** The parts of the centre that its slot cuts off at either side. */
function clippedCentre(viewer: Locator): Promise<string[]> {
  return viewer.locator(".fo-package-publication").evaluate((slot) => {
    const box = slot.getBoundingClientRect();
    return [...slot.querySelectorAll(".fo-top-slot > *")]
      .filter((part) => {
        const rect = part.getBoundingClientRect();
        return rect.left < box.left - 0.5 || rect.right > box.right + 0.5;
      })
      .map((part) => part.textContent?.trim() || part.className);
  });
}

/** Every control whole, beside the window's buttons at one edge or none. */
async function expectWholeBar(page: Page, viewer: Locator, edge?: WindowEdge) {
  if (edge) await emulateMacWindow(page, edge);
  const where = edge ? `buttons at the ${edge}` : "no window buttons";
  await expectReadableBar(viewer);
  await expect
    .poll(() => clippedCentre(viewer), `the centre is whole, ${where}`)
    .toEqual([]);
  if (edge) await clearMacWindow(page);
}

test.describe("on a Mac", () => {
  test.use({ userAgent: macAgent });

  test("at the switch width, the widest centre keeps every control whole beside the window buttons", async ({
    page,
  }) => {
    const viewer = await openWidestCentre(page, "switch-width-widest-mac");
    // The key cap draws its `⌘` as a glyph beside the `K`.
    await expect(viewer.locator(".mbk-search-hint")).toHaveText("K");
    for (const edge of ["start", "end"] as const)
      await expectWholeBar(page, viewer, edge);
  });
});

test("at the switch width, the widest centre keeps every control whole beside the wider Ctrl K search", async ({
  page,
}) => {
  const viewer = await openWidestCentre(page, "switch-width-widest-other");
  await expect(viewer.locator(".mbk-search-hint")).toHaveText("Ctrl K");
  await expectWholeBar(page, viewer);
});
