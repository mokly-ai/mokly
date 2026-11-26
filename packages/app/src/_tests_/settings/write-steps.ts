import type { Page } from "@playwright/test";

import { openDialog } from "../harness";

import type { Subject } from "./subject";

/**
 * The steps a row of the write tables takes to reach its control and to give
 * or undo its input, shared by `undoable-writes.ts` and `refusals.ts`.
 */

/**
 * The field a write is made from, named exactly.
 *
 * A loose label reaches anything that contains it, and the viewer's account
 * trigger carries the reader's own address as its accessible name — so an
 * address containing "name" makes `Name` two controls and the write is made
 * from whichever Playwright saw first.
 */
export const field = (page: Page, label: string | RegExp) =>
  typeof label === "string"
    ? page.getByLabel(label, { exact: true })
    : page.getByLabel(label);

export const fill =
  (label: string | RegExp, value: string) => async (page: Page) => {
    await field(page, label).fill(value);
  };

export const restore =
  (label: string | RegExp, saved: (subject: Subject) => string) =>
  async (page: Page, subject: Subject) => {
    await field(page, label).fill(saved(subject));
  };

export const press = (name: string | RegExp) => async (page: Page) => {
  await page.getByRole("button", { name, exact: true }).click();
};

/** Choose one of a row's own actions from its three-dot menu. */
export const choose = (row: RegExp, action: string) => async (page: Page) => {
  await page.getByRole("button", { name: row }).first().click();
  await page.getByRole("menuitem", { name: action, exact: true }).click();
};

/** Most of these controls are on a settings pane, reached by its address. */
export const pane = (name: string) => async (page: Page, subject: Subject) => {
  await openDialog(page, `${subject.projectPath}?settings=${name}`);
};
