/**
 * Which canvas frames a diff mode compares on the copied comparison output,
 * and how a compared frame shows its mode. On the wide canvas Overlay,
 * Difference and Swipe compare every shown frame, and Side by side compares
 * the first shown frame, Desktop before Mobile. The compact layout shows one
 * frame, which every mode compares: its Mobile frame while both viewports
 * show.
 */

import { expect, type Locator } from "@playwright/test";

import { frameLabels, frameModes } from "./comparison_sections.js";
import type { CompareMode } from "./comparison_ui.js";

/** A screen viewport. */
export type ScreenViewport = "desktop" | "mobile";

/** The window width below which the shell uses its compact layout. */
const COMPACT_BELOW = 900;

/**
 * The viewports whose frames of one scheme compare in `mode`, in the
 * canvas's order, while the Frames filter shows `shown` in a window
 * `width` pixels wide.
 */
export function comparedViewports(
  width: number,
  shown: "both" | ScreenViewport,
  mode: CompareMode,
): ScreenViewport[] {
  if (shown !== "both") return [shown];
  if (width < COMPACT_BELOW) return ["mobile"];
  return mode === "side" ? ["desktop"] : ["desktop", "mobile"];
}

/**
 * Expect a compared frame's section to show `mode`: one frame that stacks
 * both versions, named by `name`, such as `Desktop · Light`, or in Side by
 * side the frame's two versions, each in its own frame led by its tag.
 */
export async function expectSectionMode(
  section: Locator,
  mode: CompareMode,
  name: string,
): Promise<void> {
  const frames = mode === "side" ? 2 : 1;
  await expect(frameModes(section)).toHaveCount(frames);
  await expect(section.locator(`[data-compare-mode="${mode}"]`)).toHaveCount(
    frames,
  );
  await expect(frameLabels(section)).toHaveText(
    mode === "side"
      ? [
          new RegExp(`^Before ${name}`, "u"),
          new RegExp(`^Current ${name}`, "u"),
        ]
      : [new RegExp(`^(?:\\S+ · )?${name}`, "u")],
  );
}
