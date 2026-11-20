import {
  checkoutCommands,
  collaboratorPrice,
  customers,
  editorPrice,
  form,
  next,
  place,
  priceBody,
  priceQuery,
  subscriptionBody,
  subscriptionItemBody,
  subscriptions,
  updateSubscription,
  workspaces,
} from "./stripe-state";
import type { Item, SubscriptionState } from "./stripe-state";

/**
 * What Stripe answered the first time a write carried each idempotency key.
 * A repeated key replays that answer without acting again, which is the
 * provider behaviour the API's durable request key relies on.
 */
const replays = new Map<
  string,
  {
    method: string;
    path: string;
    body: string;
    status: number;
    payload: unknown;
  }
>();

export function route(
  method: string,
  path: string,
  query: string,
  body: string,
  idempotencyKey: string | undefined,
): { status: number; payload: unknown } {
  if (method !== "GET" && idempotencyKey !== undefined) {
    const replay = replays.get(idempotencyKey);
    if (replay) {
      if (
        replay.method !== method ||
        replay.path !== path ||
        replay.body !== body
      ) {
        return {
          status: 400,
          payload: { error: { type: "idempotency_error" } },
        };
      }
      return replay;
    }
    const answer = act(method, path, query, body);
    replays.set(idempotencyKey, { method, path, body, ...answer });
    return answer;
  }
  return act(method, path, query, body);
}

function act(
  method: string,
  path: string,
  query: string,
  body: string,
): { status: number; payload: unknown } {
  if (method === "GET" && path === "/v1/prices" && query === priceQuery) {
    return {
      status: 200,
      payload: {
        object: "list",
        url: "/v1/prices",
        has_more: false,
        data: [priceBody(editorPrice), priceBody(collaboratorPrice)],
      },
    };
  }
  if (method === "POST" && path === "/v1/customers") {
    const fields = form(body);
    const workspace = fields.get("metadata[organization_id]") ?? "";
    const id = workspaces.get(workspace) ?? next("cus_");
    customers.set(id, workspace);
    workspaces.set(workspace, id);
    return {
      status: 200,
      payload: {
        id,
        object: "customer",
        metadata: { organization_id: workspace },
      },
    };
  }
  if (method === "POST" && path === "/v1/checkout/sessions") {
    const fields = form(body);
    const workspace = fields.get("client_reference_id") ?? "";
    const command = fields.get(
      "subscription_data[metadata][checkout_session_id]",
    );
    if (workspace && command) checkoutCommands.set(workspace, command);
    const id = next("cs_test_");
    return {
      status: 200,
      payload: {
        id,
        object: "checkout.session",
        mode: "subscription",
        status: "open",
        url: "https://checkout.stripe.test/c/pay/" + id,
      },
    };
  }
  if (method === "POST" && path === "/v1/billing_portal/sessions") {
    const id = next("bps_");
    return {
      status: 200,
      payload: {
        id,
        object: "billing_portal.session",
        url: "https://billing.stripe.test/session/" + id,
      },
    };
  }
  if (path.startsWith("/v1/subscriptions/")) {
    const id = path.slice("/v1/subscriptions/".length);
    const subscription = subscriptions.get(id);
    if (!subscription) return { status: 404, payload: { error: {} } };
    if (method === "DELETE") subscription.status = "canceled";
    return { status: 200, payload: subscriptionBody(subscription) };
  }
  if (method === "POST" && path === "/v1/subscription_items") {
    const fields = form(body);
    const subscription = subscriptions.get(fields.get("subscription") ?? "");
    if (!subscription) return { status: 404, payload: { error: {} } };
    const item: Item = {
      id: next("si_"),
      price: fields.get("price") ?? "",
      quantity: Number(fields.get("quantity") ?? "1"),
      current_period_end: subscription.items[0]?.current_period_end ?? 0,
    };
    subscription.items.push(item);
    return { status: 200, payload: subscriptionItemBody(item) };
  }
  if (path.startsWith("/v1/subscription_items/")) {
    const id = path.slice("/v1/subscription_items/".length);
    for (const subscription of subscriptions.values()) {
      const item = subscription.items.find((candidate) => candidate.id === id);
      if (!item) continue;
      if (method === "DELETE") {
        subscription.items = subscription.items.filter(
          (candidate) => candidate.id !== id,
        );
        return {
          status: 200,
          payload: { id, object: "subscription_item", deleted: true },
        };
      }
      item.quantity = Number(form(body).get("quantity") ?? item.quantity);
      return { status: 200, payload: subscriptionItemBody(item) };
    }
    return { status: 404, payload: { error: {} } };
  }
  return { status: 404, payload: { error: { type: "invalid_request_error" } } };
}

export function control(
  method: string,
  path: string,
  search: URLSearchParams,
  body: string,
): { status: number; payload: unknown } {
  if (method === "GET" && path === "/__customer") {
    const id = workspaces.get(search.get("workspace") ?? "");
    return id ? { status: 200, payload: { id } } : { status: 404, payload: {} };
  }
  if (method === "GET" && path === "/__subscription") {
    const customer = workspaces.get(search.get("workspace") ?? "");
    const subscription = [...subscriptions.values()].find(
      (candidate) => candidate.customer === customer,
    );
    return subscription
      ? { status: 200, payload: subscriptionBody(subscription) }
      : { status: 404, payload: {} };
  }
  if (method === "POST" && path === "/__subscription") {
    const state = JSON.parse(body) as SubscriptionState;
    return { status: 200, payload: subscriptionBody(place(state)) };
  }
  if (method === "PATCH" && path === "/__subscription") {
    const state: unknown = JSON.parse(body);
    const subscription = updateSubscription(state);
    return subscription
      ? { status: 200, payload: subscriptionBody(subscription) }
      : { status: 404, payload: {} };
  }
  if (method === "POST" && path === "/__invoice") {
    const state = JSON.parse(body) as {
      workspace: string;
      status: string;
      attempted: boolean;
    };
    const customer = workspaces.get(state.workspace);
    const subscription = [...subscriptions.values()].find(
      (candidate) => candidate.customer === customer,
    );
    if (!subscription) return { status: 404, payload: {} };
    subscription.latest_invoice = {
      id: subscription.latest_invoice?.id ?? next("in_"),
      status: state.status,
      attempted: state.attempted,
    };
    return {
      status: 200,
      payload: { ...subscription.latest_invoice, object: "invoice" },
    };
  }
  return { status: 404, payload: {} };
}
