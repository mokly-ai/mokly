/**
 * The resolved questions of the pricing page: comment threads that Maya and
 * Sam opened on the plan frames, each answered by Mokly. The answers state
 * only what `docs/protocol/cloud/billing.md` and
 * `docs/protocol/cloud/billing-plan-gates.md` state, mostly in the words of
 * the public Plans and billing page.
 */

import type { SiteIconName } from "./icons.js";

/** A person who asks a question, with the team they work in. */
export const PRICING_ASKERS = {
  maya: { name: "Maya", team: "Design" },
  sam: { name: "Sam", team: "Engineering" },
} as const;

/** One resolved thread. */
export interface PricingQuestion {
  readonly answer: string;
  readonly asker: keyof typeof PRICING_ASKERS;
  readonly icon: SiteIconName;
  /** The last part of the question heading's id, `pricing-question-{id}`. */
  readonly id: string;
  /** The frame that the thread is pinned to, such as `plans/team`. */
  readonly pin: string;
  readonly question: string;
  readonly topic: string;
}

/** Every thread, in reading order. */
export const PRICING_QUESTIONS: readonly PricingQuestion[] = [
  {
    answer:
      "Team begins with a 7-day trial, offered once per workspace. The billing pane shows the day it ends. After that, Team is billed monthly.",
    asker: "maya",
    icon: "calendar",
    id: "trial",
    pin: "plans/team",
    question: "How does the trial work?",
    topic: "Trial",
  },
  {
    answer:
      "Settings holds a billing pane for each workspace. An owner upgrades there and returns there to change the payment method, read the renewal date or end Team. Owners and admins read the plan, the seats in use and the monthly total. Members and reviewers see the plan name and can ask an owner to upgrade.",
    asker: "sam",
    icon: "card",
    id: "billing",
    pin: "plans/team",
    question: "Who manages billing?",
    topic: "Billing",
  },
  {
    answer:
      "Inviting a member while on Team names the seat it adds and its monthly price beside the control, so the bill is visible where it changes.",
    asker: "maya",
    icon: "users",
    id: "seat",
    pin: "plans/team",
    question: "Where do I see what a new seat costs?",
    topic: "Seats",
  },
  {
    answer: "Team is billed monthly. Prices are in US dollars and exclude tax.",
    asker: "sam",
    icon: "receipt",
    id: "annual",
    pin: "plans/team",
    question: "Is there an annual price?",
    topic: "Price",
  },
  {
    answer:
      "An owner ends Team in the billing pane, and Team stays on until the current billing period ends. Deleting the workspace ends Team at once, and the remaining days are not refunded.",
    asker: "maya",
    icon: "end",
    id: "end",
    pin: "plans/team",
    question: "How do I end Team?",
    topic: "Ending",
  },
  {
    answer:
      "Private projects stay private, and the publications already in them stay readable to the people who could read them. Publishing a new catalogue to a private project takes Team again, and public projects carry on unchanged.",
    asker: "sam",
    icon: "lock",
    id: "after",
    pin: "plans/team",
    question: "What happens when Team ends?",
    topic: "Downgrade",
  },
  {
    answer: "Publication retention does not depend on the plan.",
    asker: "maya",
    icon: "history",
    id: "retention",
    pin: "plans/*",
    question: "Does the plan change how long publications are kept?",
    topic: "Retention",
  },
  {
    answer:
      "The Mokly CLI is free under the MIT license. Author and build locally, keep your screens in Git and host the static catalogue anywhere.",
    asker: "sam",
    icon: "terminal",
    id: "cloud",
    pin: "plans/open-source",
    question: "Do I need Mokly Cloud?",
    topic: "Open source",
  },
];
