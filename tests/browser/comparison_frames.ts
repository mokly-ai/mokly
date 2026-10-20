/** The pane frame attributes that the comparison panes contract requires. */

import { expect, type Locator } from "@playwright/test";

import { paneFrame } from "./comparison_scroll.js";

/**
 * The absolute address of the accepted generation that an index names, ending
 * in `/`, as a host on `origin` serves it.
 */
export function generationAddress(
  origin: string,
  comparisonUrl: string,
): string {
  return new URL(comparisonUrl.replace(/review\.json$/u, ""), `${origin}/`)
    .href;
}

/**
 * Both pane frames of a section carry every attribute of the contract: the
 * frame marker, exactly `sandbox="allow-same-origin"`, `scrolling="no"`, a
 * `srcdoc` document and no `src`, and a preview source beneath the accepted
 * generation for this path and viewport.
 */
export async function expectPaneFrameAttributes(
  section: Locator,
  generation: string,
  path: string,
  viewport: "desktop" | "mobile",
): Promise<void> {
  for (const side of ["before", "after"] as const) {
    const frame = paneFrame(section, side);
    await expect(frame).toHaveAttribute("data-mokly-comparison-frame", "");
    await expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
    await expect(frame).toHaveAttribute("scrolling", "no");
    await expect(frame).toHaveAttribute("srcdoc", /\S/u);
    await expect(frame).not.toHaveAttribute("src");
    await expect(frame).toHaveAttribute(
      "data-mokly-preview-source",
      `${generation}snapshots/${side}/mokly-generated/${path}/index.${viewport}.html`,
    );
    expect(
      await frame.evaluate(
        (element: HTMLIFrameElement) => element.contentDocument?.URL,
      ),
    ).toBe("about:srcdoc");
  }
}
