import { expect, freshEmail, openDialog } from "../harness";
import type { Subject } from "./subject";
import type { WriteUnderTest } from "./undoable-writes";
import type { Page } from "@playwright/test";

/**
 * What a write's own control says while the write works, as Write in progress
 * in `folio-chrome.md` asks: its working word on the control, and the
 * operation a screen reader hears beside it.
 */
export interface BusyWrite {
  /** The control's working word. */
  working: string;
  /** The operation a screen reader hears, built from the subject it names. */
  operation: (subject: Subject) => string;
}

const named = (operation: string) => () => operation;

/**
 * The working word and the operation of every write in `undoable-writes.ts`,
 * by its `where`. A write the table gains without a row here fails the busy
 * walk in `writes.spec.ts`, which reads them together.
 */
export const busyWrites: Readonly<Record<string, BusyWrite>> = {
  "account/save-account": {
    working: "Saving…",
    operation: named("Saving your name"),
  },
  "workspace/save-workspace": {
    working: "Saving…",
    operation: named("Saving settings"),
  },
  "project/save-project": {
    working: "Saving…",
    operation: named("Saving settings"),
  },
  "members/send-invitation": {
    working: "Sending…",
    operation: named("Sending invitation"),
  },
  "tokens/create-token": {
    working: "Creating…",
    operation: named("Creating token"),
  },
  "danger/delete-project": {
    working: "Deleting…",
    operation: named("Deleting project"),
  },
  "sign-in/email-entry": {
    working: "Sending…",
    operation: named("Sending sign-in link"),
  },
  "magic-link/send-link": {
    working: "Sending…",
    operation: named("Sending sign-in link"),
  },
  "account/create-workspace": {
    working: "Creating…",
    operation: named("Creating workspace"),
  },
  "members/save-role": {
    working: "Saving…",
    operation: named("Saving role"),
  },
  "project/confirm-visibility": {
    working: "Making public…",
    operation: (subject) => `Making ${subject.projectName} public`,
  },
  "tokens/confirm-revoke": {
    working: "Revoking…",
    operation: named("Revoking token"),
  },
  "members/confirm-remove-member": {
    working: "Removing…",
    operation: named("Removing member"),
  },
};

/**
 * The pane writes with nothing to undo, so the undo table cannot reach them:
 * each row puts the reader in front of its control, ready to press it.
 */
export const busyOnlyWrites: readonly (Omit<WriteUnderTest, "give" | "undo"> &
  BusyWrite)[] = [
  {
    where: "members/revoke-invitation",
    control: "revoke-invitation",
    visit: async (page: Page, subject: Subject) => {
      await openDialog(page, `${subject.projectPath}?settings=members`);
      await page.getByLabel("Email").fill(freshEmail("busy-invite"));
      await page.getByTestId("send-invitation").click();
      await expect(page.getByTestId("revoke-invitation")).toBeVisible();
    },
    url: "**/v1/workspaces/*/members/*",
    method: "DELETE",
    working: "Revoking…",
    operation: named("Revoking invitation"),
  },
  {
    where: "github/confirm-remove-github-account",
    control: "confirm-remove-github-account",
    visit: async (page: Page, subject: Subject) => {
      await openDialog(page, `${subject.projectPath}?settings=github`);
      await page.getByRole("button", { name: /^Actions for / }).click();
      await page.getByRole("menuitem", { name: "Remove", exact: true }).click();
    },
    url: "**/v1/github/installations/*",
    method: "DELETE",
    working: "Removing…",
    operation: named("Removing GitHub account"),
  },
];
