import type { Billing, SeatKind, SeatUsage } from "../../api/types";

/**
 * How long the one trial a workspace is offered runs.
 *
 * The plan catalogue in `docs/protocol/cloud/billing.md` is its one source of truth,
 * and the billing read does not carry it: every amount on the pane is the
 * API's own, and this is the single catalogue value the product states for
 * itself.
 */
export const trialDays = 7;

/** One catalogue amount as the pane shows it, from the cents Mokly answers. */
export function money(cents: number): string {
  return "$" + (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * One instant as a day the reader recognises, in their own time zone. Written
 * out rather than taken from a locale formatter, so the same subscription reads
 * the same way wherever the product is built and whatever ICU data it finds.
 */
export function day(instant: string): string | undefined {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.getDate() + " " + months[date.getMonth()];
}

/** What the subscription reports about the plan, which one fact carries. */
export type PlanSituation = "team" | "trial" | "past-due" | "ending";

/**
 * Which situation the read describes. A payment Stripe could not take is the
 * one the reader has to act on, so it is read first; a cancelled subscription
 * names the day Team ends before it names the trial it may still be in.
 */
export function planSituation(billing: Billing): PlanSituation {
  const subscription = billing.subscription;
  if (!subscription) return "team";
  if (subscription.status === "past_due" || subscription.paymentFailedAt) {
    return "past-due";
  }
  if (subscription.cancelAtPeriodEnd) return "ending";
  return subscription.status === "trialing" ? "trial" : "team";
}

/** One seat kind as the read reports it, whatever order the array is in. */
export function seat(billing: Billing, kind: SeatKind): SeatUsage | undefined {
  return billing.seats.find((usage) => usage.kind === kind);
}

/** The verified monthly amount of one seat kind, where there is one. */
export function unitAmount(
  billing: Billing | undefined,
  kind: SeatKind,
): number | undefined {
  if (!billing) return undefined;
  return seat(billing, kind)?.unitAmountCents ?? undefined;
}

function subtotal(usage: SeatUsage | undefined): number | undefined {
  if (!usage || usage.unitAmountCents === null) return undefined;
  return usage.inUse * usage.unitAmountCents;
}

function seatFact(usage: SeatUsage | undefined): string | undefined {
  if (!usage || usage.unitAmountCents === null) return undefined;
  return (
    usage.inUse + " in use · " + money(usage.unitAmountCents) + " each a month"
  );
}

function planFact(billing: Billing, situation: PlanSituation): string {
  const subscription = billing.subscription;
  if (situation === "trial" && subscription?.trialEnd) {
    const ends = day(subscription.trialEnd);
    if (ends) return "Team until " + ends + ", then billed monthly";
  }
  if (situation === "ending" && subscription?.currentPeriodEnd) {
    const ends = day(subscription.currentPeriodEnd);
    if (ends) return "Team ends " + ends;
  }
  return "Team";
}

/**
 * The seats in use with their unit amounts, and the total the pane computes
 * from them. A trial and a cancellation carry their own date on the plan row,
 * so neither repeats it as a renewal the subscription is not going to make.
 *
 * A row whose amount the deployment could not verify is left out rather than
 * drawn without one: a seat count beside a missing price would read as free.
 */
export function seatRows(
  billing: Billing,
  situation: PlanSituation,
): readonly (readonly [string, string])[] {
  const editors = seat(billing, "editor");
  const collaborators = seat(billing, "collaborator");
  const rows: (readonly [string, string])[] = [
    ["Plan", planFact(billing, situation)],
  ];
  const editorFact = seatFact(editors);
  if (editorFact) rows.push(["Editors", editorFact]);
  const collaboratorFact = seatFact(collaborators);
  if (collaboratorFact) rows.push(["Collaborators", collaboratorFact]);
  const editorTotal = subtotal(editors);
  const collaboratorTotal = subtotal(collaborators);
  if (editorTotal !== undefined && collaboratorTotal !== undefined) {
    rows.push(["Monthly total", money(editorTotal + collaboratorTotal)]);
  }
  const renews =
    situation === "team" && billing.subscription?.currentPeriodEnd
      ? day(billing.subscription.currentPeriodEnd)
      : undefined;
  if (renews) rows.push(["Renews", renews]);
  return rows;
}

/** The seat kind a role occupies; a reviewer collaborates, everyone else edits. */
export function seatKindOf(role: string): SeatKind {
  return role === "reviewer" ? "collaborator" : "editor";
}

/** What one invitation of the chosen role adds to the monthly bill. */
export function seatConsequence(
  billing: Billing | undefined,
  role: string,
): string | undefined {
  const kind = seatKindOf(role);
  const amount = unitAmount(billing, kind);
  if (amount === undefined) return undefined;
  return kind === "editor"
    ? "Adds an Editor seat, " + money(amount) + " a month."
    : "Adds a Collaborator seat, " + money(amount) + " a month.";
}
