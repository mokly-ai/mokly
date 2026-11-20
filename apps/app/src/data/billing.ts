import {
  api,
  correlationHeader,
  expectBody,
  mutationHeaders,
} from "../api/client";
import type { Billing } from "../api/types";

/**
 * What an owner or admin may read about the workspace's plan: the plan
 * itself, both seat kinds in use with the verified unit amount of each, the
 * subscription facts, and whether this reader may act on them. Every value is
 * the API's; the pane computes the monthly total from the counts and amounts
 * and never types a price of its own.
 *
 * A deployment with no billing configured answers `operation-unavailable`, and
 * the pane says billing opens soon where its facts would be.
 */
export function readBilling(workspaceId: string): Promise<Billing> {
  return expectBody((id) =>
    api.GET("/v1/workspaces/{workspaceId}/billing", {
      params: { path: { workspaceId } },
      headers: correlationHeader(id),
    }),
  );
}

/**
 * Start the subscription, and answer the address of Stripe's own Checkout
 * page for it.
 *
 * The cloud never sees a card, so the operation is finished somewhere else:
 * the API answers with the session it created, and the caller hands this tab
 * to its address, which returns to the pane's own address afterwards. Nothing
 * about the plan is written by that return — only the webhook writes it — so
 * the caller has nothing to update before it leaves.
 *
 * Refused with `subscription-active` while a subscription is live, with
 * `operation-unavailable` while billing is unconfigured or its prices are
 * unverified, and with `rate-limited` or `unavailable` when Stripe is.
 */
export async function startCheckout(workspaceId: string): Promise<string> {
  const session = await expectBody((id) =>
    api.POST("/v1/workspaces/{workspaceId}/billing/checkout", {
      params: { path: { workspaceId }, header: mutationHeaders() },
      headers: correlationHeader(id),
      body: {},
    }),
  );
  return session.url;
}

/**
 * Open a Stripe Customer Portal session, where payment methods, invoices and
 * cancellation live, and answer its address. The same hand-over as Checkout,
 * and the same refusals.
 */
export async function openBillingPortal(workspaceId: string): Promise<string> {
  const session = await expectBody((id) =>
    api.POST("/v1/workspaces/{workspaceId}/billing/portal", {
      params: { path: { workspaceId }, header: mutationHeaders() },
      headers: correlationHeader(id),
      body: {},
    }),
  );
  return session.url;
}
