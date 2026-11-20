import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { apiOrigin, stripeBind } from "./origins";
import { stripeSignature } from "./stripe-double";
import { collaboratorPrice, editorPrice } from "./stripe-state";

const provider = "http://" + stripeBind;

/** The seat prices the provider resolves by lookup key, for a test's own line. */
export { collaboratorPrice, editorPrice };

/**
 * Dates far enough ahead that no run reads them as the past, at midday UTC so
 * the day a reader in any ordinary time zone sees is the same one.
 */
export const trialEndsAt = Date.parse("2030-09-29T12:00:00Z") / 1000;

/** The renewal and cancellation date every subscribed fixture carries. */
export const periodEndsAt = Date.parse("2030-10-15T12:00:00Z") / 1000;

/** How the pane writes `trialEndsAt`. */
export const trialEndsOn = "29 Sep";

/** How the pane writes `periodEndsAt`. */
export const periodEndsOn = "15 Oct";

/**
 * Start Checkout through the API the pane writes with, which is what creates
 * the customer at the provider and binds it to the workspace. The hosted
 * page is Stripe's own, so a test that only needs a subscribed workspace
 * asks for the session rather than leaving for it.
 */
export async function startCheckoutThrough(
  page: Page,
  workspaceId: string,
): Promise<string> {
  return page.evaluate(
    async ([origin, id]) => {
      const session = await fetch(`${origin}/v1/session`, {
        credentials: "include",
      });
      const { csrfToken } = (await session.json()) as { csrfToken: string };
      const answer = await fetch(
        `${origin}/v1/workspaces/${id}/billing/checkout`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: "{}",
        },
      );
      if (!answer.ok) throw new Error(`checkout failed: ${answer.status}`);
      return ((await answer.json()) as { url: string }).url;
    },
    [apiOrigin, workspaceId] as const,
  );
}

/** The customer the API created at the provider for one workspace. */
async function customerOf(workspaceId: string): Promise<string> {
  const answer = await fetch(`${provider}/__customer?workspace=${workspaceId}`);
  if (!answer.ok) throw new Error("the API has created no customer yet");
  return ((await answer.json()) as { id: string }).id;
}

/** What one test asks the provider to report about the subscription. */
export interface Subscribed {
  status: "trialing" | "active" | "past_due" | "canceled";
  cancelAtPeriodEnd?: boolean;
  trialEnd?: number | null;
  editors?: number;
  collaborators?: number;
}

/** One workspace's binding at the provider, once Checkout has made it. */
export interface Binding {
  customer: string;
  subscription: string;
}

/** Deliver one signed event to the API's own webhook route. */
async function deliver(event: Record<string, unknown>): Promise<void> {
  const body = JSON.stringify({
    id: "evt_" + Math.random().toString(16).slice(2),
    created: Math.floor(Date.now() / 1000),
    ...event,
  });
  const answer = await fetch(`${apiOrigin}/v1/billing/webhooks`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": stripeSignature(body),
    },
    body,
  });
  if (answer.status !== 202) {
    throw new Error(`the API refused the delivery: ${answer.status}`);
  }
}

/** What the billing read reports about the subscription right now. */
async function subscriptionFacts(
  page: Page,
  workspaceId: string,
): Promise<{
  status: string;
  cancelAtPeriodEnd: boolean;
  paymentFailedAt: string | null;
} | null> {
  return page.evaluate(
    async ([origin, id]) => {
      const answer = await fetch(`${origin}/v1/workspaces/${id}/billing`, {
        credentials: "include",
      });
      const body = (await answer.json()) as {
        subscription: {
          status: string;
          cancelAtPeriodEnd: boolean;
          paymentFailedAt: string | null;
        } | null;
      };
      return body.subscription;
    },
    [apiOrigin, workspaceId] as const,
  );
}

/** Wait until the plan the webhook worker derived is the expected one. */
export async function planBecomes(
  page: Page,
  workspaceId: string,
  plan: "free" | "team",
): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          async ([origin, id]) => {
            const answer = await fetch(`${origin}/v1/workspaces/${id}`, {
              credentials: "include",
            });
            return ((await answer.json()) as { plan: string }).plan;
          },
          [apiOrigin, workspaceId] as const,
        ),
      { message: "the billing worker derives the plan", timeout: 30_000 },
    )
    .toBe(plan);
}

/**
 * Put the workspace on a subscription the way one really arrives: Checkout
 * creates and binds the customer, the provider reports the subscription, and
 * the API's own webhook worker retrieves it and writes the plan. Nothing here
 * writes a Mokly row; every fact the pane then reads is one the API derived.
 */
export async function subscribe(
  page: Page,
  workspaceId: string,
  state: Subscribed,
): Promise<Binding> {
  await startCheckoutThrough(page, workspaceId);
  const customer = await customerOf(workspaceId);
  const seats = [{ price: editorPrice, quantity: state.editors ?? 1 }];
  if (state.collaborators) {
    seats.push({ price: collaboratorPrice, quantity: state.collaborators });
  }
  const placed = await fetch(`${provider}/__subscription`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workspace: workspaceId,
      status: state.status,
      cancelAtPeriodEnd: state.cancelAtPeriodEnd ?? false,
      trialEnd: state.trialEnd ?? null,
      periodEnd: periodEndsAt,
      seats,
    }),
  });
  const subscription = (await placed.json()) as { id: string };
  await deliver({
    type: "customer.subscription.created",
    data: { object: { id: subscription.id, customer } },
  });
  await planBecomes(page, workspaceId, "team");
  return { customer, subscription: subscription.id };
}

/**
 * Report a subscription state change while the real seat worker owns items.
 * The API retrieves the provider state again and rewrites what it derived.
 */
export async function reportSubscription(
  page: Page,
  workspaceId: string,
  state: Pick<Subscribed, "status" | "cancelAtPeriodEnd" | "trialEnd">,
  binding: Binding,
): Promise<void> {
  const answer = await fetch(`${provider}/__subscription`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workspace: workspaceId,
      status: state.status,
      cancelAtPeriodEnd: state.cancelAtPeriodEnd ?? false,
      trialEnd: state.trialEnd ?? null,
    }),
  });
  if (!answer.ok) {
    throw new Error(`subscription update failed: ${answer.status}`);
  }
  await deliver({
    type: "customer.subscription.updated",
    data: { object: { id: binding.subscription, customer: binding.customer } },
  });
  await expect
    .poll(
      async () => {
        const facts = await subscriptionFacts(page, workspaceId);
        return (
          facts?.status === state.status &&
          facts.cancelAtPeriodEnd === (state.cancelAtPeriodEnd ?? false)
        );
      },
      {
        message: "the billing worker reconciles what Stripe now reports",
        timeout: 30_000,
      },
    )
    .toBe(true);
}

/**
 * End the subscription the way Stripe reports one that is over, which is the
 * only way a workspace returns to the free plan.
 */
export async function endSubscription(
  page: Page,
  workspaceId: string,
): Promise<void> {
  const answer = await fetch(
    `${provider}/__subscription?workspace=${workspaceId}`,
  );
  const object = (await answer.json()) as Record<string, unknown>;
  await deliver({ type: "customer.subscription.deleted", data: { object } });
  await planBecomes(page, workspaceId, "free");
}

/** Record the failed invoice Stripe reports, which the pane reads as a state. */
export async function failPayment(
  page: Page,
  workspaceId: string,
  binding: Binding,
): Promise<void> {
  const answer = await fetch(`${provider}/__invoice`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workspace: workspaceId,
      status: "open",
      attempted: true,
    }),
  });
  if (!answer.ok)
    throw new Error("the provider has no subscription to invoice");
  const invoice = (await answer.json()) as { id: string };
  await deliver({
    type: "invoice.payment_failed",
    data: {
      object: {
        id: invoice.id,
        object: "invoice",
        customer: binding.customer,
        subscription: binding.subscription,
      },
    },
  });
  await expect
    .poll(
      async () =>
        (await subscriptionFacts(page, workspaceId))?.paymentFailedAt !== null,
      {
        message: "the billing worker records the failed payment",
        timeout: 30_000,
      },
    )
    .toBe(true);
}
