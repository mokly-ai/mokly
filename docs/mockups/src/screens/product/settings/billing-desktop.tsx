import type { Viewport } from "@mokly/mokly";

import { BillingPane } from "./billing-pane";

/**
 * The Billing pane in the desktop app's window. Each action that opens
 * Stripe's own pages keeps its label and carries the external glyph, because
 * the window opens those pages in the browser.
 */

/** A free workspace in the window: Upgrade to Team opens Checkout outside. */
export function SettingsBillingDesktopScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BillingPane
      viewport={viewport}
      state="empty"
      host="window"
      screen="product/settings/billing/desktop"
    />
  );
}

/** A Team workspace in the window: Manage billing opens the Portal outside. */
export function SettingsBillingDesktopTeamScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BillingPane
      viewport={viewport}
      state="default"
      host="window"
      screen="product/settings/billing/desktop/team"
    />
  );
}
