import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

/** Each allowance must name a follow-up file that can close the difference. */
export function assertOwned(todo: string, subject: string): void {
  const named = readdirSync(
    resolve(import.meta.dirname, "../../../../plans/follow-ups"),
    { withFileTypes: true },
  ).some(
    (file) =>
      file.isFile() &&
      file.name.endsWith(".md") &&
      // Match a whole filename before any description, never a filename prefix.
      (todo === file.name || todo.startsWith(file.name + " ")),
  );
  assert.ok(
    named,
    subject + ": names no follow-up file in plans/follow-ups/ — " + todo,
  );
}

/** One allowed divergence: the screen, the label, and what closes it. */
interface Allowance {
  screen: string;
  label: string;
  todo: string;
}

/**
 * Where the catalogue and the running product still disagree about what a
 * control or a state says, with the item that closes each one. A line leaves
 * this list when the application catches up; nothing may be added without an
 * item that removes it again, because an allowlist with no owner is a
 * divergence the suite has stopped reporting. A state the running route cannot
 * reach at all is redrawn rather than allowlisted.
 *
 * Check your email uses one write per control. The refused resend still needs
 * a follow-up to redraw the catalogue's earlier state body beside Resend link.
 */
export const allowed: readonly Allowance[] = [
  {
    screen: "product/account/magic-link",
    label: "We couldn’t send your link",
    todo: "magic-link-mockups-miss-write-states.md redraws the refused resend beside Resend link",
  },
  {
    screen: "product/account/magic-link",
    label: "Request another link",
    todo: "magic-link-mockups-miss-write-states.md redraws the refused resend beside Resend link",
  },
  {
    screen: "product/viewer/standalone/catalogue",
    label: "This publication can’t open in this browser",
    todo: "blocked-cookie-message-has-no-words.md gives the app’s blocked-access card the drawn words",
  },
  {
    screen: "product/viewer/standalone/catalogue/comparison",
    label: "This publication can’t open in this browser",
    todo: "blocked-cookie-message-has-no-words.md gives the app’s blocked-access card, which its comparison overlay draws, the drawn words",
  },
];

/** Owner declarations whose screen is still waiting on a follow-up item. */
export const allowedOwnerViolations: readonly {
  violation: string;
  todo: string;
}[] = [
  {
    violation:
      "owner writes nothing this screen draws, for product/viewer/standalone/catalogue/comparison: viewer/stage.tsx",
    todo: "blocked-cookie-message-has-no-words.md gives the app’s blocked-access card, which its comparison overlay draws, the drawn words",
  },
];

/** A pending-label presentation difference waiting on its application work. */
export interface PendingModeAllowance {
  screen: string;
  label: string;
  mockupMode: "visible" | "screen-reader-only";
  applicationMode: "visible" | "screen-reader-only";
  todo: string;
}

export const allowedPendingModes: readonly PendingModeAllowance[] = [];

/** One allowed state the product announces and the catalogue does not draw. */
interface StateAllowance {
  file: string;
  title: string;
  todo: string;
}

/**
 * States the running product has that the catalogue does not draw, with the
 * item that draws each one or brings the product to the drawn words. The same
 * rule as above applies in reverse: nothing may be added without an item that
 * removes it, because a product state no screen shows is a decision nobody
 * reviewed.
 */
export const allowedStates: readonly StateAllowance[] = [
  {
    file: "viewer/panels/projects.tsx",
    title: "No workspaces yet",
    todo: "viewer-projects-without-workspaces-lacks-mockup.md draws the projects panel with no workspace at all",
  },
  {
    file: "viewer/panels/share.tsx",
    title: "Screens couldn’t load",
    todo: "share-screen-load-failure-lacks-mockup.md draws the share panel's screen list failing to load",
  },
  {
    file: "viewer/stage-view.tsx",
    title: "This project couldn’t load",
    todo: "viewer-unresolved-project-lacks-mockup.md draws the stage before it has resolved a reference",
  },
  {
    file: "viewer/panels/switcher.tsx",
    title: "More branches and pull requests",
    todo: "switcher-truncated-list-lacks-mockup.md draws the switcher's list stopping at its cap",
  },
  {
    file: "viewer/stage.tsx",
    title: "Open the catalogue in its own tab",
    todo: "blocked-cookie-message-has-no-words.md replaces the app’s blocked-access title with the drawn one",
  },
];

/** One declared sentence the product does not write yet, and what closes it. */
interface SentenceAllowance {
  screen: string;
  sentence: string;
  todo: string;
}

/**
 * Declared sentences the catalogue draws before the application writes them,
 * with the item that brings the application to each. The rule of the lists
 * above holds here too: a line leaves when the application writes its
 * sentence, and nothing may be added without an item that removes it.
 */
export const allowedSentences: readonly SentenceAllowance[] = [];
