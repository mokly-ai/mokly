import type { ReactNode } from "react";

import { billing } from "../../../fixtures/product-states";
import { site } from "../../../fixtures/site";
import type { Host } from "../host";
import {
  Action,
  ExternalLink,
  Facts,
  Pending,
  Section,
  StateMessage,
} from "../page-parts";
import { ControlPlaceholder, factPlaceholder } from "../placeholders";

/** What the subscription reports about the plan, which one fact carries. */
export type Plan = "team" | "trial" | "past-due" | "ending";

/** Who is reading: only an owner is offered a way into Stripe's own pages. */
export type Role = "owner" | "admin";

/** Whether this reader may leave for Stripe's billing surfaces. */
export function canManageBilling(role: Role): boolean {
  return role === "owner";
}

/**
 * The glyph of an action that opens Stripe's own pages: none in a browser tab,
 * which leaves for them, and the external glyph in the desktop app's window,
 * which opens them in the browser.
 */
function stripeGlyph(host: Host): "external" | undefined {
  return host === "window" ? "external" : undefined;
}

const planFact = {
  team: billing.plan,
  trial: billing.trialing,
  "past-due": billing.plan,
  ending: billing.ending,
} as const;

/**
 * The seats in use with their unit amounts, and the total the pane computes
 * from them. A trial and a cancellation carry their own date on the plan row,
 * so neither repeats it as a renewal the subscription is not going to make.
 */
function seatRows(plan: Plan): readonly (readonly [string, string])[] {
  const rows: (readonly [string, string])[] = [
    ["Plan", planFact[plan]],
    ["Editors", billing.editors.inUse + " · " + billing.editors.each],
    [
      "Collaborators",
      billing.collaborators.inUse + " · " + billing.collaborators.each,
    ],
    ["Monthly total", billing.total],
  ];
  if (plan === "team") rows.push(["Renews", billing.renews]);
  return rows;
}

/**
 * A subscribed workspace: what it is paying for, and the one way to change
 * it. Payment failed is the state of the subscription rather than a failure of
 * this page — nothing was pressed and nothing was refused — so it draws no
 * reference, and its one action replaces Manage billing rather than joining it.
 * Manage billing leaves for Stripe's own pages, so while its write runs, the
 * control stays busy until the page leaves. In the desktop app's window it
 * opens them in the browser, so it carries the external glyph there.
 */
export function TeamPlan({
  plan,
  role,
  opening = false,
  host = "browser",
}: {
  plan: Plan;
  role: Role;
  /** Manage billing's write is running. */
  opening?: boolean;
  host?: Host;
}) {
  const manageable = canManageBilling(role);
  return (
    <div className="fo-stack">
      {plan === "past-due" && (
        <StateMessage
          title={billing.copy.paymentFailed}
          error
          action={
            manageable ? (
              <Action
                label="Update payment method"
                tone="primary"
                size="md"
                icon="external"
              />
            ) : undefined
          }
        >
          {!manageable ? billing.copy.adminReads : undefined}
        </StateMessage>
      )}
      <section className="fo-section fo-section-flush">
        <Facts rows={seatRows(plan)} />
        {!manageable && plan !== "past-due" ? (
          <p className="fo-copy">{billing.copy.adminReads}</p>
        ) : (
          manageable &&
          plan !== "past-due" && (
            <div>
              <Action
                label={opening ? "Opening…" : "Manage billing"}
                tone="primary"
                size="md"
                icon={stripeGlyph(host)}
                busy={opening ? "Opening the billing portal" : undefined}
              />
            </div>
          )
        )}
      </section>
    </div>
  );
}

/** The width of Manage billing at a page action's size, in px. */
const manageBillingWidth = 133;

/**
 * The subscribed workspace's facts while billing is read, the most common
 * form: each value a bar of one text line, and a placeholder for the action,
 * because whether there is one, and which, the plan and the reader decide.
 * `plan` stands in the Plan value: the read's name, or a bar where the read
 * has not started.
 */
export function TeamPlanWaiting({ plan }: { plan: ReactNode }) {
  return (
    <div className="fo-stack">
      <section className="fo-section fo-section-flush">
        <Facts
          rows={[
            ["Plan", plan],
            factPlaceholder("Editors", "min(9em, 100%)"),
            factPlaceholder("Collaborators", "min(9em, 100%)"),
            factPlaceholder("Monthly total", "3em"),
            factPlaceholder("Renews", "3.5em"),
          ]}
        />
        <div>
          <ControlPlaceholder size="md" width={manageBillingWidth} />
        </div>
      </section>
    </div>
  );
}

/**
 * The billing read, whether the pane loads or a returned Checkout confirms
 * the subscription. The plan is the value the read decides, so its place
 * names the read.
 */
export function TeamPlanWait({ label }: { label: string }) {
  return (
    <Pending label={label}>{(name) => <TeamPlanWaiting plan={name} />}</Pending>
  );
}

/**
 * A workspace with no subscription, and what Team would cost it.
 *
 * A configured price Mokly could not verify against the catalogue leaves the
 * section its title and its way on, and takes away every amount: a number
 * Stripe would not charge is worse than no number, so the plans on the public
 * site are where the reader is sent for one. Upgrade to Team leaves for
 * Stripe's Checkout, so while its write runs, the control stays busy until the
 * page leaves. In the desktop app's window it opens Checkout in the browser,
 * so it carries the external glyph there.
 */
export function FreePlan({
  verified = true,
  role,
  opening = false,
  host = "browser",
}: {
  verified?: boolean;
  role: Role;
  /** Upgrade to Team's write is running. */
  opening?: boolean;
  host?: Host;
}) {
  const manageable = canManageBilling(role);
  return (
    <div className="fo-stack">
      <StateMessage title={billing.copy.freeHeadline} icon="project">
        Every project is public.
      </StateMessage>
      <Section title="Team">
        {verified && (
          <Facts
            rows={[
              ["Editor", billing.editors.price],
              ["Collaborator", billing.collaborators.price],
            ]}
          />
        )}
        {verified && <p className="fo-copy">{billing.trial}</p>}
        {manageable ? (
          <div>
            <Action
              label={opening ? "Opening…" : "Upgrade to Team"}
              tone="primary"
              size="md"
              icon={stripeGlyph(host)}
              busy={opening ? "Opening checkout" : undefined}
            />
          </div>
        ) : (
          <p className="fo-copy">{billing.copy.adminReads}</p>
        )}
        {!verified && <ExternalLink to={site.pricing} label="Pricing" />}
      </Section>
    </div>
  );
}
