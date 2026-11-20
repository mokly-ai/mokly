/**
 * The writes of the settings panes that `settings-writes.test.ts` holds to
 * Write in progress, each by its drawing at rest and while it runs. A write
 * that leaves for GitHub or Stripe is drawn while it runs, before the page
 * leaves.
 */

import { sample, token } from "../fixtures/product";
import { membership, profile, slugEdits } from "../fixtures/product-states";

/**
 * Each write: its drawing at rest and while it runs, the control that sends
 * it with the working word it then shows, what screen readers hear, and each
 * field the reader filled, by its id, with the value that stays in it.
 */
export const writes = [
  {
    resting: "account",
    running: "account/loading",
    control: "Save changes",
    working: "Saving…",
    heard: "Saving your name…",
    fields: [["account-name", profile.name]],
  },
  {
    resting: "project",
    running: "project/loading",
    control: "Save changes",
    working: "Saving…",
    heard: "Saving settings…",
    fields: [["project-name", sample.project]],
  },
  {
    resting: "project/slug",
    running: "project/slug/loading",
    control: "Save changes",
    working: "Saving…",
    heard: "Saving project address…",
    fields: [["project-slug", slugEdits.project.draft]],
  },
  {
    resting: "workspace/slug",
    running: "workspace/slug/loading",
    control: "Save changes",
    working: "Saving…",
    heard: "Saving workspace address…",
    fields: [["workspace-slug", slugEdits.workspace.draft]],
  },
  {
    resting: "danger",
    running: "danger/loading",
    control: "Delete project",
    working: "Deleting…",
    heard: "Deleting project…",
    fields: [["delete-confirmation", sample.project]],
  },
  {
    resting: "tokens/create",
    running: "tokens/create/loading",
    control: "Create token",
    working: "Creating…",
    heard: "Creating token…",
    fields: [["token-name", token.name]],
  },
  {
    resting: "tokens/revoke",
    running: "tokens/revoke/loading",
    control: "Revoke token",
    working: "Revoking…",
    heard: "Revoking token…",
    fields: [],
  },
  {
    resting: "members/remove",
    running: "members/remove/loading",
    control: "Remove Sam",
    working: "Removing…",
    heard: "Removing member…",
    fields: [],
  },
  {
    resting: "github/remove",
    running: "github/remove/loading",
    control: "Remove",
    working: "Removing…",
    heard: "Removing GitHub account…",
    fields: [],
  },
  {
    resting: "account/empty",
    running: "account/github-connecting",
    control: "Connect GitHub",
    working: "Connecting…",
    heard: "Connecting to GitHub…",
    fields: [],
  },
  {
    resting: "workspace",
    running: "workspace/saving",
    control: "Save changes",
    working: "Saving…",
    heard: "Saving settings…",
    fields: [["workspace-name", sample.workspace]],
  },
  {
    resting: "github",
    running: "github/adding",
    control: "Add GitHub account",
    working: "Adding…",
    heard: "Adding a GitHub account…",
    fields: [],
  },
  {
    resting: "members",
    running: "members/invitation-sending",
    control: "Send invitation",
    working: "Sending…",
    heard: "Sending invitation…",
    fields: [["invitation-email", membership.inviting]],
  },
  {
    resting: "members",
    running: "members/invitation-revoking",
    control: "Revoke invitation",
    working: "Revoking…",
    heard: "Revoking invitation…",
    fields: [],
  },
  {
    resting: "members",
    running: "members/role-saving",
    control: "Save role",
    working: "Saving…",
    heard: "Saving role…",
    fields: [],
  },
  {
    resting: "billing/empty",
    running: "billing/checkout-opening",
    control: "Upgrade to Team",
    working: "Opening…",
    heard: "Opening checkout…",
    fields: [],
  },
  {
    resting: "billing",
    running: "billing/portal-opening",
    control: "Manage billing",
    working: "Opening…",
    heard: "Opening the billing portal…",
    fields: [],
  },
  {
    resting: "billing/delayed",
    running: "billing/delayed/checking",
    control: "Check again",
    working: "Checking…",
    heard: "Checking your subscription…",
    fields: [],
  },
] as const;
