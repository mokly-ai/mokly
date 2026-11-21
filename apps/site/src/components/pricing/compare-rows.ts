/**
 * The rows of the pricing page's compare table: one column for each plan,
 * and the properties grouped as a component's props table groups its
 * sections. Each value states a fact of the plan catalogue in
 * `docs/protocol/cloud/billing.md`, of the plan gates in
 * `docs/protocol/cloud/billing-plan-gates.md` or of the MIT-licensed Mokly
 * CLI, in the words of the site mockup `design/site/pricing`.
 */

import { TEAM_SEATS, TRIAL_LENGTH } from "./plan-facts.js";

/** One of the three plans, in the order the page draws them. */
export type PricingPlanKey = "openSource" | "free" | "team";

/** A compare column: the product line over the plan's name. */
export interface PricingColumn {
  readonly key: PricingPlanKey;
  readonly line: string;
  readonly plan: string;
}

/** The compare columns, one for each plan. */
export const PRICING_COLUMNS: readonly PricingColumn[] = [
  { key: "openSource", line: "Mokly CLI", plan: "Open source" },
  { key: "free", line: "Mokly Cloud", plan: "Free" },
  { key: "team", line: "Mokly Cloud", plan: "Team" },
];

/**
 * One plan's value in a row: `true` is included and `false` is not, a string
 * is the value as text, `token` is a value drawn as a token, such as a
 * project's visibility, and `lines` is a value of several lines with a note
 * under them.
 */
export type PricingValue =
  | boolean
  | string
  | { readonly token: string }
  | { readonly lines: readonly string[]; readonly note: string };

/** One property of the comparison, with an optional note under its name. */
export interface PricingRow {
  readonly label: string;
  readonly note?: string;
  readonly values: Readonly<Record<PricingPlanKey, PricingValue>>;
}

/** A group of rows, as a props table groups its sections. */
export interface PricingGroup {
  readonly rows: readonly PricingRow[];
  readonly title: string;
}

/** Every group of the comparison, in reading order. */
export const PRICING_GROUPS: readonly PricingGroup[] = [
  {
    rows: [
      {
        label: "Mokly CLI",
        note: "MIT license",
        values: { free: true, openSource: true, team: true },
      },
      {
        label: "Host the static catalogue anywhere",
        values: { free: true, openSource: true, team: true },
      },
    ],
    title: "Open source",
  },
  {
    rows: [
      {
        label: "Public projects",
        values: { free: "Unlimited", openSource: false, team: "Unlimited" },
      },
      {
        label: "Private projects",
        values: { free: false, openSource: false, team: "Unlimited" },
      },
      {
        label: "New projects start",
        values: {
          free: { token: "public" },
          openSource: false,
          team: { token: "private" },
        },
      },
      {
        label: "Publish to a private project",
        values: { free: false, openSource: false, team: true },
      },
      {
        label: "Cloud builds",
        values: {
          free: "Public only",
          openSource: false,
          team: "Every project",
        },
      },
    ],
    title: "Mokly Cloud",
  },
  {
    rows: [
      {
        label: "Seats",
        values: {
          free: "Unlimited",
          openSource: false,
          team: "Billed per seat",
        },
      },
      {
        label: "Invitations and project grants",
        values: { free: "Not limited", openSource: false, team: "Not limited" },
      },
    ],
    title: "People",
  },
  {
    rows: [
      {
        label: "Price",
        values: {
          free: "$0",
          openSource: "$0",
          team: {
            lines: TEAM_SEATS.map((seat) => `${seat.kind} ${seat.amount}`),
            note: "a month",
          },
        },
      },
      {
        label: "Trial",
        values: {
          free: false,
          openSource: false,
          team: `${TRIAL_LENGTH}, once per workspace`,
        },
      },
      {
        label: "Currency and tax",
        values: {
          free: false,
          openSource: false,
          team: "US dollars, before tax",
        },
      },
      {
        label: "Annual price",
        values: { free: false, openSource: false, team: "None" },
      },
    ],
    title: "Billing",
  },
];
