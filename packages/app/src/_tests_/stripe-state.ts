import { randomBytes } from "node:crypto";

/** The seat prices the plan catalogue records, in USD cents. */
const amounts: Record<string, number> = {
  price_editorfixture: 2000,
  price_collaboratorfixture: 500,
};

/** The Editor price identifier returned for its catalogue lookup key. */
export const editorPrice = "price_editorfixture";

/** The Collaborator price identifier returned for its catalogue lookup key. */
export const collaboratorPrice = "price_collaboratorfixture";

export interface Item {
  id: string;
  price: string;
  quantity: number;
  current_period_end: number;
}

interface Invoice {
  id: string;
  status: string;
  attempted: boolean;
}

interface Subscription {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  trial_end: number | null;
  metadata: Record<string, string>;
  items: Item[];
  latest_invoice: Invoice | null;
}

export const customers = new Map<string, string>();
export const workspaces = new Map<string, string>();
export const subscriptions = new Map<string, Subscription>();
export const checkoutCommands = new Map<string, string>();
let sequence = 0;

/**
 * The database outlives one suite run, and a provider identifier is unique in
 * it, so every run mints its own: a counter alone hands the next run the
 * customer the last one already bound to a different workspace.
 */
const run = randomBytes(6).toString("hex");

export function next(prefix: string): string {
  sequence += 1;
  return prefix + run + sequence;
}

export function form(body: string): Map<string, string> {
  const parsed = new URLSearchParams(body);
  return new Map(parsed.entries());
}

export function subscriptionItemBody(item: Item): unknown {
  const kind = seatKind(item.price);
  return {
    id: item.id,
    object: "subscription_item",
    price: {
      id: item.price,
      lookup_key: lookupKey(item.price),
      metadata: kind === null ? {} : { mokly_seat_kind: kind },
      object: "price",
    },
    quantity: item.quantity,
    current_period_end: item.current_period_end,
  };
}

export function subscriptionBody(subscription: Subscription): unknown {
  return {
    id: subscription.id,
    object: "subscription",
    customer: subscription.customer,
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    trial_end: subscription.trial_end,
    metadata: subscription.metadata,
    latest_invoice: subscription.latest_invoice
      ? { ...subscription.latest_invoice, object: "invoice" }
      : null,
    items: {
      object: "list",
      has_more: false,
      data: subscription.items.map(subscriptionItemBody),
    },
  };
}

/** What one test asks the provider to be reporting about a subscription. */
export interface SubscriptionState {
  workspace: string;
  status: string;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: number | null;
  periodEnd: number;
  seats: { price: string; quantity: number }[];
}

export function place(state: SubscriptionState): Subscription {
  const customer = workspaces.get(state.workspace);
  if (!customer) throw new Error("no customer for " + state.workspace);
  const existing = [...subscriptions.values()].find(
    (candidate) => candidate.customer === customer,
  );
  const checkoutCommand = checkoutCommands.get(state.workspace);
  const subscription: Subscription = {
    id: existing?.id ?? next("sub_"),
    customer,
    status: state.status,
    cancel_at_period_end: state.cancelAtPeriodEnd ?? false,
    trial_end: state.trialEnd ?? null,
    metadata: {
      organization_id: state.workspace,
      ...(checkoutCommand ? { checkout_session_id: checkoutCommand } : {}),
    },
    items: state.seats.map((seat, index) => ({
      id: existing?.items[index]?.id ?? next("si_"),
      price: seat.price,
      quantity: seat.quantity,
      current_period_end: state.periodEnd,
    })),
    latest_invoice: existing?.latest_invoice ?? null,
  };
  subscriptions.set(subscription.id, subscription);
  return subscription;
}

/** Change provider state without competing with the real seat worker's writes. */
export function updateSubscription(state: unknown): Subscription | undefined {
  if (
    typeof state !== "object" ||
    state === null ||
    !("workspace" in state) ||
    typeof state.workspace !== "string" ||
    !("status" in state) ||
    typeof state.status !== "string"
  ) {
    throw new Error("The subscription update needs a workspace and status.");
  }
  const cancellation =
    "cancelAtPeriodEnd" in state ? state.cancelAtPeriodEnd : false;
  const trialEnd = "trialEnd" in state ? state.trialEnd : null;
  if (
    typeof cancellation !== "boolean" ||
    (trialEnd !== null && typeof trialEnd !== "number")
  ) {
    throw new Error("The subscription update has invalid state fields.");
  }
  const customer = workspaces.get(state.workspace);
  const subscription = [...subscriptions.values()].find(
    (candidate) => candidate.customer === customer,
  );
  if (!subscription) return undefined;
  subscription.status = state.status;
  subscription.cancel_at_period_end = cancellation;
  subscription.trial_end = trialEnd;
  return subscription;
}

export function priceBody(id: string): unknown {
  const editor = id === editorPrice;
  return {
    id,
    object: "price",
    created: 1790380800,
    active: true,
    currency: "usd",
    unit_amount: amounts[id] ?? 1,
    product: {
      id: "prod_teamfixture",
      object: "product",
      active: true,
      created: 1790380800,
      metadata: { mokly_lookup_key: "mokly_team" },
      name: "Mokly Team",
    },
    lookup_key: editor
      ? "mokly_team_editor_usd_month"
      : "mokly_team_collaborator_usd_month",
    nickname: editor ? "Editor seat" : "Collaborator seat",
    tax_behavior: "exclusive",
    metadata: {
      mokly_seat_kind: editor ? "editor" : "collaborator",
    },
    recurring: { interval: "month", usage_type: "licensed", interval_count: 1 },
  };
}

function lookupKey(id: string): string | null {
  if (id === editorPrice) return "mokly_team_editor_usd_month";
  if (id === collaboratorPrice) return "mokly_team_collaborator_usd_month";
  return null;
}

function seatKind(id: string): string | null {
  if (id === editorPrice) return "editor";
  if (id === collaboratorPrice) return "collaborator";
  return null;
}

export const priceQuery = new URLSearchParams([
  ["active", "true"],
  ["lookup_keys[]", "mokly_team_editor_usd_month"],
  ["lookup_keys[]", "mokly_team_collaborator_usd_month"],
  ["expand[]", "data.product"],
  ["limit", "10"],
]).toString();
