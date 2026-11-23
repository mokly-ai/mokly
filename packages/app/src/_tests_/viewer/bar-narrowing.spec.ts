import { expect, open, test } from "../harness";

import { makePublic, publishedProject, publishedViewerReady } from "./support";

/*
 * What the full bar gives up as its own width narrows: at a 1180px window it
 * shows History's label and the pill's short SHA, as the prototype does; then
 * it drops the SHA, then History's label, then the pill's state phrase, whose
 * dot stays, and then it draws the compact bar with More.
 */

test("the full bar shows History's label and the SHA at 1180px, and drops them, then the phrase, as it narrows", async ({
  page,
}) => {
  const made = await publishedProject(page, "viewer-bar-narrowing");
  await makePublic(page, made.projectId);
  await page.setViewportSize({ width: 1180, height: 900 });
  await open(page, made.publicationPath);
  await publishedViewerReady(page);
  const viewer = page.locator("[data-mokly-shell]");
  const pill = viewer.locator(".fo-package-slot-center .fo-canvas-pill");
  const sha = pill.locator(".mono-value");
  const phrase = pill.locator(".fo-top-state-detail");
  const dot = pill.locator('.fo-top-state > [aria-hidden="true"]');
  const history = viewer.getByTestId("viewer-history");
  const more = viewer.getByTestId("viewer-more");

  // Each width sits between two of the bar's rules, widest first.
  for (const [width, shown] of [
    [1180, { label: "History", sha: true, phrase: true }],
    [1174, { label: "History", sha: false, phrase: true }],
    [1100, { label: "", sha: false, phrase: true }],
    [1040, { label: "", sha: false, phrase: false }],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await expect(history, `History at ${width}px`).toHaveText(shown.label);
    await expect(sha, `the SHA at ${width}px`).toBeVisible({
      visible: shown.sha,
    });
    await expect(phrase, `the phrase at ${width}px`).toBeVisible({
      visible: shown.phrase,
    });
    await expect(dot, `the dot at ${width}px`).toBeVisible();
    await expect(more, `More at ${width}px`).toBeHidden();
  }

  // A narrower bar draws the compact composition, with More.
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect(more).toBeVisible();
  await expect(history).toBeHidden();
});
