/**
 * The facts of the pricing page. The cloud plans follow the plan catalogue
 * of `docs/protocol/cloud/billing.md` and the writes that
 * `docs/protocol/cloud/billing-plan-gates.md` gates; the open-source plan is
 * the MIT-licensed Mokly CLI. The comparison's rows live here; the resolved
 * questions live in `pricing-questions-data.ts`.
 */

/** One of the three plans, in the order the page draws them. */
export type PricingPlanKey = "openSource" | "free" | "team";

/**
 * Team's monthly price of each seat kind, in US dollars before tax: the plan
 * catalogue's Editor 2000 and Collaborator 500 USD cents. `holders` names the
 * roles that hold the seat, in the words of the public Plans and billing
 * page.
 */
export const TEAM_SEATS = [
  { amount: "$20", holders: "Owners, admins and members", kind: "Editor" },
  { amount: "$5", holders: "Reviewers", kind: "Collaborator" },
] as const;

/** A comparison column: the product line over the plan's name. */
export interface PricingColumn {
  readonly key: PricingPlanKey;
  readonly line: string;
  readonly plan: string;
}

/** The comparison's columns, one for each plan. */
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
          team: "7 days, once per workspace",
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
