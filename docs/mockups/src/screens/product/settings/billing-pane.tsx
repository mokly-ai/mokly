import type { Viewport } from "@mokly/mokly";

import type { ScreenState } from "../../../fixtures/product-states";
import { billing, failureReference } from "../../../fixtures/product-states";
import { Action, StateMessage } from "../page-parts";

import type { Plan, Role } from "./billing-plans";
import { FreePlan, TeamPlan, TeamPlanWait } from "./billing-plans";
import { SettingsSurface } from "./surface";

/**
 * A situation this pane owns beyond its four states: the landing Checkout
 * returns to, and the two the deployment decides — billing that is not
 * configured at all, and a configured price the catalogue could not confirm.
 * The pane's waits while settings loads are drawn in `billing-waits.tsx`.
 */
type Situation = "confirming" | "delayed" | "unavailable" | "unpriced";

/**
 * The pane's write that is running: Upgrade to Team opening Checkout, Manage
 * billing opening the Customer Portal, or Check again reading the plan once.
 */
export type BillingWrite = "checkout" | "portal" | "check";

export function BillingPane({
  state,
  viewport,
  plan = "team",
  role = "owner",
  situation,
  writing,
  screen,
}: {
  state: ScreenState;
  viewport: Viewport;
  /** What the subscription reports, where it is not simply running. */
  plan?: Plan;
  /** An admin reads the same facts; only an owner is offered the actions. */
  role?: Role;
  /** A situation of the pane itself rather than of the read behind it. */
  situation?: Situation;
  /** The pane's own write, while it runs. */
  writing?: BillingWrite;
  /** A pane drawing one of its own situations names that entry itself. */
  screen?: string;
}) {
  return (
    <SettingsSurface
      pane="billing"
      state={state}
      screen={screen}
      viewport={viewport}
      title="Billing"
    >
      {situation === "unavailable" ? (
        // Nothing failed, nothing is loading and there is nothing to press:
        // this deployment has no billing to read. So the pane says the one
        // thing it knows, flush, where its facts would be.
        <section className="fo-notice" role="status">
          {billing.copy.opensSoon}
        </section>
      ) : situation === "delayed" ? (
        <section className="review-inline">
          <p className="fo-notice" role="status">
            {billing.copy.delayed}
          </p>
          <Action
            label={writing === "check" ? "Checking…" : "Check again"}
            tone="primary"
            size="md"
            busy={
              writing === "check" ? "Checking your subscription" : undefined
            }
          />
        </section>
      ) : situation === "confirming" ? (
        <TeamPlanWait label={billing.copy.confirming} />
      ) : state === "loading" ? (
        <TeamPlanWait label="Loading billing" />
      ) : state === "error" ? (
        <StateMessage
          title={billing.copy.readFailed}
          error
          reference={failureReference}
          action={
            <Action
              label="Try again"
              to="product/settings/billing"
              tone="primary"
              size="md"
              icon="retry"
            />
          }
        />
      ) : state === "empty" ? (
        <FreePlan
          verified={situation !== "unpriced"}
          role={role}
          opening={writing === "checkout"}
        />
      ) : (
        <TeamPlan plan={plan} role={role} opening={writing === "portal"} />
      )}
    </SettingsSurface>
  );
}

export function SettingsBillingScreen({ viewport }: { viewport: Viewport }) {
  return <BillingPane viewport={viewport} state="default" />;
}

export function SettingsBillingEmptyScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <BillingPane viewport={viewport} state="empty" />;
}

export function SettingsBillingLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <BillingPane viewport={viewport} state="loading" />;
}

export function SettingsBillingErrorScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <BillingPane viewport={viewport} state="error" />;
}

/**
 * The landing Checkout returns to. The plan is written by the webhook rather
 * than by the return, so the pane says what it is doing and offers nothing to
 * press until it knows.
 */
export function SettingsBillingConfirmingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BillingPane
      viewport={viewport}
      state="default"
      situation="confirming"
      screen="product/settings/billing/confirming"
    />
  );
}

/** Checkout returned, but the bounded confirmation ended before Team appeared. */
export function SettingsBillingDelayedScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BillingPane
      viewport={viewport}
      state="default"
      situation="delayed"
      screen="product/settings/billing/delayed"
    />
  );
}

/** Team until the trial ends, when the payment method is charged. */
export function SettingsBillingTrialScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BillingPane
      viewport={viewport}
      state="default"
      plan="trial"
      screen="product/settings/billing/trial"
    />
  );
}

/** A payment Stripe could not take, whose one action opens its own pages. */
export function SettingsBillingPastDueScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BillingPane
      viewport={viewport}
      state="default"
      plan="past-due"
      screen="product/settings/billing/past-due"
    />
  );
}

/** Cancelled, and still Team until the period it is paid for ends. */
export function SettingsBillingEndingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BillingPane
      viewport={viewport}
      state="default"
      plan="ending"
      screen="product/settings/billing/ending"
    />
  );
}

/** The same facts read by an admin, whose way on is asking an owner. */
export function SettingsBillingAdminScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BillingPane
      viewport={viewport}
      state="default"
      role="admin"
      screen="product/settings/billing/admin"
    />
  );
}

/** The free plan read by an admin, with facts but no way into Checkout. */
export function SettingsBillingAdminFreeScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BillingPane
      viewport={viewport}
      state="empty"
      role="admin"
      screen="product/settings/billing/admin-free"
    />
  );
}

/** A deployment with no billing configured, which every preview runs as. */
export function SettingsBillingUnavailableScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BillingPane
      viewport={viewport}
      state="default"
      situation="unavailable"
      screen="product/settings/billing/unavailable"
    />
  );
}

/** A free workspace whose configured price could not be verified. */
export function SettingsBillingUnpricedScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BillingPane
      viewport={viewport}
      state="empty"
      situation="unpriced"
      screen="product/settings/billing/unpriced"
    />
  );
}
