/** The pane frame attributes that the comparison panes contract requires. */

import { expect, type Locator } from "@playwright/test";

import { snapshotViewPath } from "../../packages/viewer/src/navigation/routes.js";

import {
  paneFrame,
  type FrameScheme,
  type Side,
} from "./comparison_sections.js";

/**
 * The absolute address of a generation root, ending in `/`, as a host on
 * `origin` serves it: an index's `comparisonUrl`, or the root of one of the
 * generation's snapshot documents.
 */
export function generationAddress(origin: string, address: string): string {
  return new URL(address.replace(/snapshots\/.*$/u, ""), `${origin}/`).href;
}

/**
 * Both pane frames of a section carry every attribute of the contract: the
 * frame marker, exactly `sandbox="allow-same-origin"`, `scrolling="no"`, a
 * `srcdoc` document and no `src`, and a preview source beneath the accepted
 * generation for this path, viewport and scheme.
 */
export async function expectPaneFrameAttributes(
  section: Locator,
  generation: string,
  path: string,
  viewport: "desktop" | "mobile",
  scheme: FrameScheme = "light",
): Promise<void> {
  for (const side of ["before", "after"] as const satisfies Side[]) {
    const frame = paneFrame(section, side);
    await expect(frame).toHaveAttribute("data-mokly-comparison-frame", "");
    await expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
    await expect(frame).toHaveAttribute("scrolling", "no");
    await expect(frame).toHaveAttribute("srcdoc", /\S/u);
    await expect(frame).not.toHaveAttribute("src");
    await expect(frame).toHaveAttribute(
      "data-mokly-preview-source",
      new URL(snapshotViewPath(side, path, viewport, scheme), generation).href,
    );
    expect(
      await frame.evaluate(
        (element: HTMLIFrameElement) => element.contentDocument?.URL,
      ),
    ).toBe("about:srcdoc");
  }
}
