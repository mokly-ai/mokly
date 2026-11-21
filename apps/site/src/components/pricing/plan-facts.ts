/**
 * The plan facts that the pricing page states, from the plan catalogue of
 * `docs/protocol/cloud/billing.md`: Team's two monthly seat prices in USD
 * cents, the trial length in days and the currency. The page shows them in
 * reader words, such as `$20` or `7-day`, which this module derives, so each
 * fact is written once. `tests/pricing.test.ts` holds the facts equal to the
 * verified catalogue in `crates/mkc-domain/src/billing.rs`.
 */

/** The currency of every price, as the plan catalogue names it. */
export const CURRENCY = "usd";

/** Team's monthly price of each seat kind, in USD cents before tax. */
export const SEAT_PRICES_CENTS = {
  collaborator: 500,
  editor: 2000,
} as const;

/** The length of Team's trial in days. A workspace has one trial. */
export const TRIAL_DAYS = 7;

const PRICE = new Intl.NumberFormat("en-US", {
  currency: CURRENCY,
  style: "currency",
  trailingZeroDisplay: "stripIfInteger",
});

/** A price in USD cents as the page shows it: `$20`, or `$19.99` with cents. */
export function dollars(cents: number): string {
  return PRICE.format(cents / 100);
}

const ONE_DAY = new Intl.PluralRules("en-US").select(TRIAL_DAYS) === "one";

/** The trial length before a noun, as in `Start a 7-day trial`. */
export const TRIAL_SPAN = `${TRIAL_DAYS}-day`;

/** The trial length on its own, as in `7 days, once per workspace`. */
export const TRIAL_LENGTH = `${TRIAL_DAYS} ${ONE_DAY ? "day" : "days"}`;

/** One of Team's seat kinds: its monthly price and the roles that hold it. */
export interface TeamSeat {
  readonly amount: string;
  readonly holders: string;
  readonly kind: string;
}

/**
 * Team's seat kinds in the order the page lists them. `holders` names the
 * roles that hold the seat, in the words of the Plans and billing page.
 */
export const TEAM_SEATS: readonly TeamSeat[] = [
  {
    amount: dollars(SEAT_PRICES_CENTS.editor),
    holders: "Owners, admins and members",
    kind: "Editor",
  },
  {
    amount: dollars(SEAT_PRICES_CENTS.collaborator),
    holders: "Reviewers",
    kind: "Collaborator",
  },
];
