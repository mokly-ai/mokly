import type { Locator, Page } from "@playwright/test";

import type { BuildScenario } from "./build-scenario";
import { expect } from "./harness";

/**
 * The parts every row of the shared build state table uses: what a row is,
 * the two surfaces it runs on, and the parts of the build card a row reads.
 * `build-states.ts` lists the rows; `build-states.spec.ts` runs them on the
 * desktop, and `build-states-mobile.spec.ts` runs on a phone the rows that use
 * a phone's own way in.
 */

/** Where a row runs, and the ways in that differ between the two surfaces. */
export interface Surface {
  name: "desktop" | "phone";
  /** Open the History panel from the bar, the way this surface offers it. */
  openHistory: (page: Page) => Promise<void>;
  /** The Billing pane Open billing opened over the viewer, or as a route. */
  expectBilling: (page: Page) => Promise<void>;
}

/** The desktop bar: History is its own action, and settings open as a dialog. */
export const desktop: Surface = {
  name: "desktop",
  openHistory: async (page) => {
    await page.getByTestId("viewer-history").click();
  },
  expectBilling: async (page) => {
    await expect(page).toHaveURL(/settings=billing/);
    await expect(page.getByRole("dialog")).toBeVisible();
  },
};

/** A phone's compact bar: History is in More, and settings are routes. */
export const phone: Surface = {
  name: "phone",
  openHistory: async (page) => {
    await page.getByTestId("viewer-more").click();
    const menu = page.getByRole("menu", { name: "More" });
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: "History", exact: true }).click();
  },
  expectBilling: async (page) => {
    await expect(
      page.getByRole("heading", { level: 1, name: "Billing" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  },
};

/**
 * One row of the table: one state, action, refusal, answer, card or list
 * entry the build surfaces show. A row signs nobody in: the runner gives it a
 * fresh owner's project whose build operations a double answers.
 */
export interface BuildStateRow {
  /** What the row shows, as each surface's test is titled. */
  title: string;
  /** A short name for the account the row's scenario signs in. */
  label: string;
  /** Put the reader on the state, check what it shows, and take its way on. */
  run: (page: Page, scenario: BuildScenario, surface: Surface) => Promise<void>;
}

/** The CI setup guide every Publish from CI opens. */
export const ciGuide = /\/docs\/ci\/publish-from-ci\/$/;

/** The build card the stage shows. */
export function buildCard(page: Page): Locator {
  return page.locator(".fo-build");
}

/** One step's column on the build card. */
export function step(page: Page, id: "checkout" | "install" | "publish") {
  return page.locator(`[data-mkc-build-step="${id}"]`);
}

/** What each of the three steps reads, in order. */
export async function expectSteps(
  page: Page,
  words: readonly [string, string, string],
): Promise<void> {
  const ids = ["checkout", "install", "publish"] as const;
  for (const [index, id] of ids.entries())
    await expect(step(page, id)).toContainText(words[index]);
}

/** The state the publication slot names beside the reference. */
export function slotState(page: Page): Locator {
  return page.locator(".fo-top-state");
}

/** The card's title, as a heading the reader can reach. */
export function cardTitle(page: Page, name: string): Locator {
  return buildCard(page).getByRole("heading", { name });
}

/**
 * Where a failed card's summary sets its rows: the reference reads after the
 * message and still sits between the title and the line on screen, one space
 * step from each, all three on one left edge. Answers each row out of place.
 */
export function summaryProblems(summary: Element): string[] {
  const box = (selector: string) =>
    summary.querySelector(selector)?.getBoundingClientRect();
  const title = box(".fo-state-title");
  const reference = box(".fo-build-reference");
  const line = box(".fo-build-line");
  if (!title || !reference || !line) return ["missing a row"];
  const step =
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize) *
    0.25;
  const near = (a: number, b: number) => Math.abs(a - b) <= 1;
  const problems: string[] = [];
  if (!near(reference.top - title.bottom, step))
    problems.push("reference is not one step below the title");
  if (!near(line.top - reference.bottom, step))
    problems.push("line is not one step below the reference");
  if (!near(reference.left, title.left) || !near(line.left, title.left))
    problems.push("rows are not aligned");
  return problems;
}
