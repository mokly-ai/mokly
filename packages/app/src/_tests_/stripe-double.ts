import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import type { Server } from "node:http";

import { stripeBind, stripePort, stripeWebhookSecret } from "./origins";
import { control, route } from "./stripe-routes";

/**
 * The provider the API talks to while the browser suite runs.
 *
 * The cloud reaches Stripe through one HTTP boundary, so a loopback origin
 * that answers the documented shapes is the whole of what the API needs to
 * run with billing configured: the catalogue prices it resolves at startup, the customer
 * and the hosted sessions Checkout and the Portal create, and the subscription
 * the webhook worker retrieves before it reconciles. Nothing here fakes a
 * Mokly answer — every value the reader sees still comes from the API reading
 * its own database, which these objects are what wrote.
 *
 * The recorded shapes are the ones `crates/mkc-billing-stripe/fixtures` keeps,
 * narrowed to the fields `mkc-billing-interface` decodes.
 */

/** One header value, whichever shape Node parsed it into. */
function header(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

let server: Server | undefined;

/** Start the provider double the API is configured against. */
export function startStripeDouble(): Promise<void> {
  const listener = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const url = new URL(request.url ?? "/", "http://localhost");
      const body = Buffer.concat(chunks).toString("utf8");
      const answer = url.pathname.startsWith("/__")
        ? control(request.method ?? "GET", url.pathname, url.searchParams, body)
        : route(
            request.method ?? "GET",
            url.pathname,
            url.searchParams.toString(),
            body,
            header(request.headers["idempotency-key"]),
          );
      response.statusCode = answer.status;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(answer.payload));
    });
  });
  server = listener;
  return new Promise((ready) => {
    listener.listen(stripePort, "127.0.0.1", () => {
      listener.unref();
      ready();
    });
  });
}

/** Stop the provider double this run started. */
export function stopStripeDouble(): void {
  server?.close();
  server = undefined;
}

/** The address the API reaches the double at. */
export const stripeOrigin = `http://${stripeBind}`;

/**
 * Sign one event body the way Stripe signs a delivery, so the API's own
 * verifier accepts it and the real worker derives the plan from it.
 */
export function stripeSignature(body: string): string {
  const seconds = Math.floor(Date.now() / 1000);
  const digest = createHmac("sha256", stripeWebhookSecret)
    .update(seconds + "." + body)
    .digest("hex");
  return `t=${seconds},v1=${digest}`;
}
