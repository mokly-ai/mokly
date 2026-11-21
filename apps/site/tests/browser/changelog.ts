/**
 * What the changelog specs share: the releases that the page draws, read
 * through the site's own reader, and the parts of the page as a reader finds
 * them.
 */
import type { Locator, Page } from "@playwright/test";

import { readReleases } from "../../src/changelog/releases.js";

/** The releases that the page draws, newest first. */
export const RELEASES = readReleases();

/** Runs a test in the desktop projects only. */
export const DESKTOP = { tag: "@desktop" };

/** How many of the newest releases draw as full frames, as the page contract says. */
export const FULL_FRAMES = 6;

/**
 * The note rows of the release groups. They are list items, a role that the
 * count chips and the layer trees share, so a role locator cannot tell them
 * apart.
 */
export const NOTE_ROWS = ".site-release-group > ul > li";

/** How many notes the releases list, in one kind of group or in all. */
export function notes(kind?: string): number {
  return RELEASES.flatMap((release) => release.groups)
    .filter((group) => kind === undefined || group.kind === kind)
    .reduce((sum, group) => sum + group.notes.length, 0);
}

/** Whether a release lists notes of one kind of group. */
export function lists(
  release: (typeof RELEASES)[number],
  kind: string,
): boolean {
  return release.groups.some((group) => group.kind === kind);
}

/** The frame of one release, named by its heading. */
export function frame(page: Page, version: string): Locator {
  return page.getByRole("article", {
    exact: true,
    name: `Mokly CLI ${version}`,
  });
}

/** The note filter. */
export function filter(page: Page): Locator {
  return page.getByRole("group", { name: "Show notes" });
}

/**
 * Choose an option of the filter, as a reader presses it. The option is the
 * radio's label, whose transparent band for the 44px target lies over its
 * words, so the press goes to the label.
 */
export async function choose(page: Page, name: string): Promise<void> {
  await filter(page)
    .locator("label", { hasText: new RegExp(`^${name} \\d+$`) })
    .click();
}

/** The filter's status line, which counts what the page shows. */
export function status(page: Page): Locator {
  return page.getByText(/ in \d+ releases?$/);
}

/** Version history. */
export function history(page: Page): Locator {
  return page.getByRole("navigation", { name: "Version history" });
}

/** The Version history row of one release, which leads with its version. */
export function row(page: Page, version: string): Locator {
  return history(page).getByRole("link", {
    name: new RegExp(`^v${version.replaceAll(".", "\\.")}\\b`),
  });
}

/** A size tag such as `22 notes`. */
export function size(count: number): string {
  return `${count} note${count === 1 ? "" : "s"}`;
}
