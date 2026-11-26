import type { Page } from "@playwright/test";

import { open, openDialog } from "../harness";

import type { Subject } from "./subject";

/**
 * Every write whose input the reader can undo.
 *
 * The repository step is not one of them: its input is a repository chosen from
 * the installed list, and a choice has no way back out of itself. Its refusal
 * is asserted in `refusals.ts` like every control with nothing to undo.
 *
 * A failure belongs to the attempt that made it, so undoing the input the
 * attempt was made from takes the notice, its details and its way back with
 * it. That is a property of every write made through `settings/write.ts`
 * rather than of any one surface, so it is asserted the same way wherever the
 * control lives: a row says how to reach its control rather than naming a
 * pane, because the entry screens' control is not on one, and the setup steps'
 * controls are reached by walking to the step that holds them. A walk of
 * `writes.spec.ts` leaves out a row that `covered-writes.ts` names for it,
 * because a test of that control already proves its own wiring.
 */
export interface WriteUnderTest {
  /** The control, named for the assertion that fails. */
  where: string;
  /** The control that makes the write. */
  control: string;
  /** Put the reader in front of that control, wherever it lives. */
  visit: (page: Page, subject: Subject) => Promise<void>;
  /** The endpoint and method that has to fail. */
  url: string;
  method: string;
  /** Put something in the input, then take it back out again. */
  give: (page: Page, subject: Subject) => Promise<void>;
  undo: (page: Page, subject: Subject) => Promise<void>;
}

/**
 * What the undone control leaves behind.
 *
 * A form keeps its control on screen, so it can be asked what it says with
 * nothing pending and nothing failed, and whether it would take a press. A
 * confirmation is itself the input: undoing it closes the confirmation and
 * takes the control with it, which is the same statement made more strongly —
 * there is nothing left to press.
 */
export type UndoableWrite = WriteUnderTest &
  (
    | {
        settles: "resting";
        resting: string;
        /**
         * The sentence this form's own field draws for `validation-failed`,
         * when it declares one. A cause the reader's own text produced is
         * reported there, and the control keeps its own label, because
         * sending the same text again is the same refusal.
         */
        owns?: string;
      }
    | { settles: "closed" }
  );

/** What a field a form owns says, unless that form declares its own sentence. */
export const sharedFieldCopy = "Check the values and try again.";

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

const fill = (label: string | RegExp, value: string) => async (page: Page) => {
  await field(page, label).fill(value);
};

const restore =
  (label: string | RegExp, saved: (subject: Subject) => string) =>
  async (page: Page, subject: Subject) => {
    await field(page, label).fill(saved(subject));
  };

const press = (name: string | RegExp) => async (page: Page) => {
  await page.getByRole("button", { name, exact: true }).click();
};

/** Choose one of a row's own actions from its three-dot menu. */
const choose = (row: RegExp, action: string) => async (page: Page) => {
  await page.getByRole("button", { name: row }).first().click();
  await page.getByRole("menuitem", { name: action, exact: true }).click();
};

/** Most of these controls are on a settings pane, reached by its address. */
const pane = (name: string) => async (page: Page, subject: Subject) => {
  await openDialog(page, `${subject.projectPath}?settings=${name}`);
};

export const writes: readonly UndoableWrite[] = [
  {
    where: "account/save-account",
    control: "save-account",
    visit: pane("account"),
    owns: sharedFieldCopy,
    resting: "Save changes",
    url: "**/v1/account",
    method: "PATCH",
    settles: "resting",
    give: fill("Name", "Undone name"),
    undo: restore("Name", (subject) => subject.accountName),
  },
  {
    where: "workspace/save-workspace",
    control: "save-workspace",
    visit: pane("workspace"),
    owns: sharedFieldCopy,
    resting: "Save changes",
    url: "**/v1/workspaces/*",
    method: "PATCH",
    settles: "resting",
    give: fill("Workspace name", "Undone workspace"),
    undo: restore("Workspace name", (subject) => subject.workspaceName),
  },
  {
    where: "project/save-project",
    control: "save-project",
    visit: pane("project"),
    owns: sharedFieldCopy,
    resting: "Save changes",
    url: "**/v1/projects/*",
    method: "PATCH",
    settles: "resting",
    give: fill("Project name", "undone-project"),
    undo: restore("Project name", (subject) => subject.projectName),
  },
  {
    where: "members/send-invitation",
    control: "send-invitation",
    visit: pane("members"),
    owns: sharedFieldCopy,
    resting: "Send invitation",
    url: "**/v1/workspaces/*/members",
    method: "POST",
    settles: "resting",
    give: fill("Email", "undone-invite@example.com"),
    undo: fill("Email", ""),
  },
  {
    where: "tokens/create-token",
    control: "create-token",
    visit: async (page, subject) => {
      await pane("tokens")(page, subject);
      await page.getByTestId("new-token").click();
    },
    owns: sharedFieldCopy,
    resting: "Create token",
    url: "**/v1/projects/*/tokens",
    method: "POST",
    settles: "resting",
    give: fill("Token name", "Undone token"),
    undo: fill("Token name", ""),
  },
  {
    where: "danger/delete-project",
    control: "delete-project",
    visit: pane("danger"),
    owns: sharedFieldCopy,
    resting: "Delete project",
    url: "**/v1/projects/*",
    method: "DELETE",
    settles: "resting",
    give: async (page, subject) => {
      await page.getByLabel(/^Type /).fill(subject.projectName);
    },
    undo: async (page) => {
      await page.getByLabel(/^Type /).fill("not the name");
    },
  },
  {
    // The entry screens' own write. Its input is the address, so clearing the
    // address is what there is to undo.
    where: "sign-in/email-entry",
    control: "email-entry",
    visit: async (page) => {
      await open(page, "/sign-in");
    },
    owns: "Enter a complete email address.",
    resting: "Continue with email",
    url: "**/v1/auth/magic-links",
    method: "POST",
    settles: "resting",
    give: fill("Email", "undone-entry@example.com"),
    undo: fill("Email", ""),
  },
  {
    // Check your email's other control. A reader with no pending link types
    // the address themselves, so that address is the input to undo. It owns no
    // field: the control has no form of its own, so every cause it can be
    // refused with is reported above it.
    where: "magic-link/send-link",
    control: "send-link",
    visit: async (page) => {
      await open(page, "/auth/email?returnTo=/dashboard");
    },
    resting: "Send sign-in link",
    url: "**/v1/auth/magic-links",
    method: "POST",
    settles: "resting",
    give: fill("Email", "undone-send@example.com"),
    undo: fill("Email", ""),
  },
  {
    // The second setup step. Its input is the workspace's name, so emptying
    // the name is what there is to undo.
    where: "account/create-workspace",
    control: "create-workspace",
    visit: async (page) => {
      await open(page, "/new");
    },
    resting: "Create workspace",
    url: "**/v1/workspaces",
    method: "POST",
    settles: "resting",
    give: fill("Workspace name", "Undone Org"),
    undo: fill("Workspace name", ""),
  },
  {
    where: "members/save-role",
    control: "save-role",
    visit: pane("members"),
    resting: "Save role",
    url: "**/v1/workspaces/*/members/*",
    method: "PATCH",
    settles: "resting",
    give: async (page, subject) => {
      await page
        .locator(".fo-member-row")
        .filter({ hasText: subject.colleague })
        .getByRole("button", { name: "Manage" })
        .click();
      await page
        .getByRole("region", { name: /^Manage / })
        .getByRole("radio", { name: "Admin" })
        .click();
    },
    undo: async (page) => {
      await page
        .getByRole("region", { name: /^Manage / })
        .getByRole("radio", { name: "Reviewer" })
        .click();
    },
  },
  {
    where: "project/confirm-visibility",
    control: "confirm-visibility",
    visit: pane("project"),
    url: "**/v1/projects/*",
    method: "PATCH",
    settles: "closed",
    give: press("Make public"),
    undo: press("Keep private"),
  },
  {
    where: "tokens/confirm-revoke",
    control: "confirm-revoke",
    visit: pane("tokens"),
    url: "**/v1/projects/*/tokens/*",
    method: "DELETE",
    settles: "closed",
    give: choose(/^Actions for /, "Revoke"),
    undo: press("Keep token"),
  },
  {
    where: "members/confirm-remove-member",
    control: "confirm-remove-member",
    visit: pane("members"),
    url: "**/v1/workspaces/*/members/*",
    method: "DELETE",
    settles: "closed",
    give: async (page, subject) => {
      await page
        .locator(".fo-member-row")
        .filter({ hasText: subject.colleague })
        .getByRole("button", { name: "Manage" })
        .click();
      await page.getByTestId("remove-member").click();
    },
    undo: press("Keep access"),
  },
];
