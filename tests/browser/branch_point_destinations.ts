/**
 * Tally's Affected destinations in the branch-point cases, and what each one
 * shows once its link opens it: the shown status, whether the Changes tab's
 * band offers the compare modes, and the outcome line of each compared frame.
 * The wide canvas compares every shown frame of the routed entry's row; the
 * compact layout compares its one shown frame, which the link names.
 */

import { expect, type Page } from "@playwright/test";

import { branchPointPaths as paths } from "../helpers/branch_point_sources.js";

import type { BranchPointHost } from "./branch_point_ui.js";
import { rowOutcomes, screenOutcomes } from "./comparison_outcomes.js";
import {
  expectNoCompareModes,
  modeButton,
  outcomeLines,
} from "./comparison_ui.js";
import { openPanelTab } from "./workspace_actions.js";

/** The layout breakpoint of the shell, in CSS pixels. */
const COMPACT_BELOW = 900;

const SCREEN = "Components this screen uses changed";
const VARIANT = "Components this variant uses changed";

/** A layout of the shell: the wide canvas, or the compact layout. */
type Layout = "compact" | "wide";

/** A view's viewport, which an Affected link names. */
type Viewport = "desktop" | "mobile";

/** What a destination shows: its shown status and its outcome lines. */
interface Shown {
  lines: readonly string[];
  status: "Added" | "Changed" | "Unmodified";
}

/** One of Tally's Affected destinations, in the list's order. */
export interface Destination {
  /** The link's comparison intent: Side by side, or none for an Added view. */
  comparison: "side" | null;
  /** Whether Changes lists the destination. */
  listed: boolean;
  path: string;
  /** What the destination shows in a layout, opened at the link's viewport. */
  shows(layout: Layout, viewport: Viewport): Shown;
  text: string;
}

/** The compact layout's one frame of a screen: the linked view's Light frame. */
function linkedFrame(viewport: Viewport, label: string): string {
  return `${viewport === "mobile" ? "Mobile" : "Desktop"} · Light · ${label}`;
}

export const TALLY_AFFECTED: readonly Destination[] = [
  {
    // The wide canvas compares the routed row's Light and Dark frames; the
    // compact layout shows one frame at a time, the picked Light frame.
    comparison: "side",
    listed: false,
    path: paths.impactParent,
    shows: (layout) => ({
      lines:
        layout === "wide"
          ? rowOutcomes("Meter", VARIANT)
          : [`Meter · Light · ${VARIANT}`],
      status: "Unmodified",
    }),
    text: "Meter",
  },
  {
    comparison: "side",
    listed: false,
    path: paths.impactVariant,
    shows: (layout) => ({
      lines:
        layout === "wide"
          ? rowOutcomes("default", VARIANT)
          : [`default · Light · ${VARIANT}`],
      status: "Unmodified",
    }),
    text: "default",
  },
  {
    comparison: "side",
    listed: true,
    path: paths.impactMoved,
    shows: (layout, viewport) => ({
      lines:
        layout === "wide"
          ? screenOutcomes(SCREEN)
          : [linkedFrame(viewport, SCREEN)],
      status: "Unmodified",
    }),
    text: "Slip",
  },
  {
    // Ledger's desktop views changed, so the wide canvas, which also shows
    // them, reads Changed; the linked view alone reads Unmodified.
    comparison: "side",
    listed: true,
    path: paths.impactLedger,
    shows: (layout, viewport) =>
      layout === "wide"
        ? {
            lines: ["Light", "Dark"].flatMap((scheme) => [
              `Desktop · ${scheme} · Screen changed`,
              `Mobile · ${scheme} · ${SCREEN}`,
            ]),
            status: "Changed",
          }
        : { lines: [linkedFrame(viewport, SCREEN)], status: "Unmodified" },
    text: "Ledger",
  },
  {
    comparison: null,
    listed: true,
    path: paths.impactAdded,
    shows: () => ({ lines: [], status: "Added" }),
    text: "New consumer",
  },
];

/**
 * Unmodified destinations offer the band for the linked view. Serve and the
 * copy open Side by side, which lists the outcome of each compared frame; a
 * React host opens Current. Added destinations keep Current without a band.
 */
export async function expectAffectedBand(
  page: Page,
  host: BranchPointHost,
  destination: Destination,
  viewport: Viewport,
): Promise<void> {
  const layout =
    page.viewportSize()!.width < COMPACT_BELOW ? "compact" : "wide";
  const { lines, status } = destination.shows(layout, viewport);
  await expect(page.locator("[data-workspace-status]")).toHaveText(status);
  // Show the panel, which the compact layout holds in a sheet, so a check
  // that its band is absent reads the panel's tabs.
  await openPanelTab(page, "Inspect");
  if (destination.comparison === null) return expectNoCompareModes(page);
  await openPanelTab(page, "Changes");
  await expect(
    page.getByRole("group", { name: "Comparison mode" }),
  ).toBeVisible();
  const mode = host.affectedLinks === "current" ? "Current" : "Side by side";
  await expect(modeButton(page, mode)).toHaveAttribute("aria-pressed", "true");
  if (mode === "Side by side")
    await expect(outcomeLines(page)).toHaveText(lines);
}
