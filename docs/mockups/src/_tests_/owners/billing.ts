import { shared } from "../app-regions";
import type { Owner } from "../app-regions";

export const billingOwners = {
  // The pane owns the four states and the deployment's own two situations;
  // the plans beside it own what a subscribed and an unsubscribed
  // workspace each read, which is where every label on those pages is
  // written.
  "product/settings/billing": {
    region: "pane",
    files: [
      "settings/panes/billing-pane.tsx",
      "settings/panes/billing-plans.tsx",
      ...shared,
    ],
  },
  // The pane asked for by its address while the session and the scope load.
  // Every value waits as a bar and every control as a placeholder, so the
  // scope's wait, which names the wait, is all it says.
  "product/settings/billing/scope-loading": {
    region: "pane",
    files: ["settings/scope-wait.tsx"],
  },
  // The same wait on the pane's durable route on a wide surface until it
  // hands over to the dialog. The rail, whose panes with no address yet wait
  // disabled, is the frame's, so the pane says what the scope's wait says.
  "product/settings/billing/route-loading": {
    region: "pane",
    files: ["settings/scope-wait.tsx"],
  },
  // The landing Checkout returns to, which offers nothing to press until the
  // webhook has written the plan: the pane names what it is doing and the
  // comparison reads that sentence rather than a control.
  "product/settings/billing/confirming": {
    region: "pane",
    files: ["settings/panes/billing-pane.tsx"],
  },
  // The bounded confirmation ended before Team appeared. The pane owns this
  // notice and its one fresh read, just as it owns confirming.
  "product/settings/billing/delayed": {
    region: "pane",
    files: ["settings/panes/billing-pane.tsx"],
  },
  // Check again's write: the pane owns its one fresh read, its working word
  // and the operation, as it owns the delayed notice.
  "product/settings/billing/delayed/checking": {
    region: "pane",
    files: ["settings/panes/billing-pane.tsx"],
  },
  "product/settings/billing/trial": {
    region: "pane",
    files: ["settings/panes/billing-plans.tsx"],
  },
  "product/settings/billing/past-due": {
    region: "pane",
    files: ["settings/panes/billing-plans.tsx"],
  },
  "product/settings/billing/ending": {
    region: "pane",
    files: ["settings/panes/billing-plans.tsx"],
  },
  // The same facts read by an admin, whose way on is a sentence rather than a
  // control, so this page too is compared by what it says.
  "product/settings/billing/admin": {
    region: "pane",
    files: ["settings/panes/billing-plans.tsx"],
  },
  // The free plan read by an admin has the same role boundary and no action.
  "product/settings/billing/admin-free": {
    region: "pane",
    files: ["settings/panes/billing-plans.tsx"],
  },
  // The deployment's own two: billing that is not configured at all, whose
  // whole drawing is one notice, and a configured price the catalogue could
  // not confirm, which keeps the section its title and its way on.
  "product/settings/billing/unavailable": {
    region: "pane",
    files: ["settings/panes/billing-pane.tsx"],
  },
  "product/settings/billing/unpriced": {
    region: "pane",
    files: ["settings/panes/billing-plans.tsx"],
  },
  // Upgrade to Team's and Manage billing's writes, which leave for Stripe.
  // The plans own each control, its working word and the operation, and the
  // free plan's state title.
  "product/settings/billing/checkout-opening": {
    region: "pane",
    files: ["settings/panes/billing-plans.tsx"],
  },
  "product/settings/billing/portal-opening": {
    region: "pane",
    files: ["settings/panes/billing-plans.tsx"],
  },
  // The plans in the desktop app's window, where each Stripe action carries
  // the external glyph because it opens Stripe's pages in the browser.
  "product/settings/billing/desktop": {
    region: "pane",
    files: ["settings/panes/billing-plans.tsx"],
  },
  "product/settings/billing/desktop/team": {
    region: "pane",
    files: ["settings/panes/billing-plans.tsx"],
  },
} as const satisfies Record<string, Owner>;
