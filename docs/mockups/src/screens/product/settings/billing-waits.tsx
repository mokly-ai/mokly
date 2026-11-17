import type { Viewport } from "@mokly/mokly";

import { Pending } from "../page-parts";
import { TextBar } from "../placeholders";

import { TeamPlanWaiting } from "./billing-plans";
import { panes } from "./panes";
import { SettingsSurface } from "./surface";

/**
 * The Billing pane while settings loads: the subscribed workspace's facts,
 * its most common form, with every value a bar. The pane's own read has not
 * started, so the plan is a bar too, and the wait is named for screen readers
 * only.
 */
function BillingSettingsWait() {
  return (
    <Pending label="Loading settings" labelMode="screen-reader-only">
      <TeamPlanWaiting plan={<TextBar width="4em" />} />
    </Pending>
  );
}

/**
 * The Billing pane asked for by its address while the session and the
 * settings scope load, as Stripe's Checkout and Customer Portal return to it:
 * the rail draws the sections that the address's scope gives an owner. The
 * dialog over the page beneath draws it, and so does the full-screen layer.
 */
export function SettingsBillingScopeLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <SettingsSurface
      pane="billing"
      state="default"
      viewport={viewport}
      title="Billing"
      screen="product/settings/billing/scope-loading"
    >
      <BillingSettingsWait />
    </SettingsSurface>
  );
}

/** The panes that need a project, which a workspace's route does not name. */
const projectPanes = panes
  .filter((pane) => pane.section === "Project")
  .map((pane) => pane.id);

/**
 * The Billing pane's durable route, as Stripe returns to it, while the route
 * reads the session, the settings scope and the page to hand over to. On a
 * wide surface it draws the dialog's wait over the stage placeholder until the
 * dialog over that page takes over. The route's address names its workspace
 * and no project, so the rail draws each Project pane disabled, with no link.
 * On a compact surface the route is the full-screen layer, which draws the
 * same wait.
 */
export function SettingsBillingRouteLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <SettingsSurface
      pane="billing"
      state="default"
      viewport={viewport}
      title="Billing"
      screen="product/settings/billing/route-loading"
      unaddressed={projectPanes}
    >
      <BillingSettingsWait />
    </SettingsSurface>
  );
}
