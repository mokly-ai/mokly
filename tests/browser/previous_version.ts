import type { FrameLocator, Locator, Page } from "@playwright/test";

/** Where a previous version stands: a page, a viewer's root, or a frame. */
type Scope = FrameLocator | Locator | Page;

/** The host of a removed entry's previous version, which holds its canvas. */
export const PREVIOUS = "[data-mokly-preview]";

/**
 * The quiet label after the Removed status: `Showing previous version`, or
 * its Light-only form. The previous version's section head holds it, and in
 * the compact layout, whose section has no head, the entry bar.
 */
export function previousVersionLabel(scope: Scope): Locator {
  return scope
    .locator(`${PREVIOUS}, [data-entry-bar]`)
    .getByText(/^Showing previous version/u)
    .filter({ visible: true });
}

/**
 * One frame of a removed screen's section, by its viewport and its scheme:
 * the figure that its label names, such as `Desktop · Light`, which holds
 * the historical document, or the note of a view never captured. The one
 * frame of the compact layout leads its name with the entry's slug.
 */
export function historicalFrame(
  scope: Scope,
  viewport: "desktop" | "mobile",
  scheme: "dark" | "light" = "light",
): Locator {
  const name = `${viewport === "desktop" ? "Desktop" : "Mobile"} · ${
    scheme === "dark" ? "Dark" : "Light"
  }`;
  return scope
    .locator(PREVIOUS)
    .getByRole("figure", { name: new RegExp(`^(?:\\S+ · )?${name}`, "u") });
}
