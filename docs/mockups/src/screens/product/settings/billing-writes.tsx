import type { Viewport } from "@mokly/mokly";

import { BillingPane } from "./billing-pane";

/**
 * The Billing pane's own writes while they run. Upgrade to Team and Manage
 * billing leave for Stripe's own pages, so each control stays busy with its
 * working word until the page leaves; Check again reads the plan once and
 * stays busy until the answer comes. The pane around each control stays as it
 * was, and nothing is inserted.
 */

/** Upgrade to Team while it opens Stripe's Checkout for a free workspace. */
export function SettingsBillingCheckoutOpeningScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BillingPane
      viewport={viewport}
      state="empty"
      writing="checkout"
      screen="product/settings/billing/checkout-opening"
    />
  );
}

/** Manage billing while it opens the Customer Portal for a Team workspace. */
export function SettingsBillingPortalOpeningScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BillingPane
      viewport={viewport}
      state="default"
      writing="portal"
      screen="product/settings/billing/portal-opening"
    />
  );
}

/** Check again while its one fresh read of the subscription runs. */
export function SettingsBillingCheckingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BillingPane
      viewport={viewport}
      state="default"
      situation="delayed"
      writing="check"
      screen="product/settings/billing/delayed/checking"
    />
  );
}
