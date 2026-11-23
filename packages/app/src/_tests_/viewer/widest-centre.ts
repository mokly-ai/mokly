import type { Locator, Page } from "@playwright/test";

import { publicationPathFor } from "../addresses";
import { fillPullRequest } from "../database-fixture";
import { expect, open } from "../harness";
import { headSha, publish } from "../publish";

import { taggedLayoutFixture } from "./layout-fixture";
import { publishedProject, publishedViewerReady } from "./support";

/**
 * The narrowest bar that draws the full composition: the one switch width in
 * the shared `viewer-bar.css`, 63.875rem, at the default text size.
 */
export const switchWidth = 63.875 * 16;

/** A Mac's user agent: the search's key hint names `⌘K` there. */
export const macAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/** The pull request of the widest centre, as GitHub observed it. */
export const widestPull = {
  number: 7,
  title: "Hold the widest centre",
  author: "octocat",
  branch: "widest",
} as const;

/**
 * Open the widest centre at the switch width: a pull request's older
 * publication in its Changes view, so the pill stands beside the Changes
 * badge, GitHub and View latest, in a catalogue whose tags give the search
 * its tag picker. It answers the viewer and the head SHA of the publication
 * that the pill names.
 */
export async function openWidestCentre(
  page: Page,
  label: string,
): Promise<{ viewer: Locator; head: string }> {
  const tagged = taggedLayoutFixture();
  const head = headSha(label);
  try {
    const made = await publishedProject(page, label, {
      branch: "main",
      fixture: tagged.path,
    });
    fillPullRequest(made.projectId, widestPull);
    const input = {
      branch: widestPull.branch,
      pullRequest: widestPull.number,
      fixture: tagged.path,
    };
    const older = await publish(made.token, made.projectId, {
      ...input,
      headSha: head,
    });
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
  return { viewer, head };
}
