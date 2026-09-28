import {
  expect,
  type FrameLocator,
  type Locator,
  type Page,
} from "@playwright/test";

/** Shell copy for a view whose Live preview cannot run. */
export const UNAVAILABLE = "Live preview is unavailable for this view.";

/** The toolbar's Static/Live group. */
export function previewMode(page: Page): Locator {
  return page.getByRole("group", { name: "Preview mode" });
}

/** The mounted Live document for one viewport. */
export function liveFrame(
  page: Page,
  viewport: "desktop" | "mobile",
): FrameLocator {
  return page.frameLocator(`iframe[data-mokly-live-frame="${viewport}"]`);
}

/** Static is the selected segment. */
export async function expectStatic(page: Page): Promise<void> {
  const group = previewMode(page);
  await expect(group.getByRole("button", { name: "Static" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(group.getByRole("button", { name: "Live" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
}

/** Live is the selected segment. */
export async function expectLive(page: Page): Promise<void> {
  const group = previewMode(page);
  await expect(group.getByRole("button", { name: "Live" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(group.getByRole("button", { name: "Static" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
}

/** Wait until every visible workspace frame shows its mounted Live document. */
export async function expectLiveReady(page: Page, frames = 2): Promise<void> {
  await expect(
    page.locator('.mbk-live-frame[data-live-frame-state="ready"]'),
  ).toHaveCount(frames, { timeout: 30_000 });
  await expect(page.locator(".mbk-live-preparing")).toHaveCount(0);
}
