import type { ReactNode } from "react";

import type { Billing } from "../../api/types";
import { ownerManagesBilling } from "../../api/labels";
import { Action } from "../../components/action";
import {
  ExternalLink,
  Facts,
  Pending,
  Section,
  StateMessage,
} from "../../components/page-parts";
import {
  ControlPlaceholder,
  factPlaceholder,
} from "../../components/placeholders";
import { site } from "../../config";
import type { Write } from "../write";
import { money, seatRows, trialDays, unitAmount } from "./billing-facts";
import type { PlanSituation } from "./billing-facts";

/** The width in px of Manage billing at a page action's size. */
const manageBillingWidth = 133;

/**
 * A subscribed workspace's layout, which its facts and their waits both draw:
 * a state above the facts where the subscription has one, the facts, and what
 * the reader can do below them.
 */
function TeamPlanLayout({
  alert,
  rows,
  below,
}: {
  alert?: ReactNode;
  rows: readonly (readonly [string, ReactNode])[];
  below: ReactNode;
}) {
  return (
    <div className="fo-stack">
      {alert}
      <section className="fo-section fo-section-flush">
        <Facts rows={rows} />
        {below}
      </section>
    </div>
  );
}

/**
 * The subscribed workspace's facts while billing is read, the most common
 * form: each value a bar of one text line, and a placeholder for the action,
 * which the plan and the reader decide. `plan` stands in the Plan value: the
 * read's name, or a bar where the read has not started.
 */
export function TeamPlanWaiting({ plan }: { plan: ReactNode }) {
  return (
    <TeamPlanLayout
      rows={[
        ["Plan", plan],
        factPlaceholder("Editors", "min(9em, 100%)"),
        factPlaceholder("Collaborators", "min(9em, 100%)"),
        factPlaceholder("Monthly total", "3em"),
        factPlaceholder("Renews", "3.5em"),
      ]}
      below={
        <div>
          <ControlPlaceholder size="md" width={manageBillingWidth} />
        </div>
      }
    />
  );
}

/**
 * The billing read, whether the pane loads or a returned Checkout confirms
 * the subscription. The plan is the value the read decides, so its place
 * names the read, visibly: a confirmation can last thirty seconds.
 */
export function TeamPlanWait({ label }: { label: string }) {
  return (
    <Pending label={label}>{(name) => <TeamPlanWaiting plan={name} />}</Pending>
  );
}

/**
 * A subscribed workspace: what it is paying for, and the one way to change
 * it. Payment failed is the state of the subscription rather than a failure of
 * this page — nothing was pressed and nothing was refused — so its one action
 * replaces Manage billing rather than joining it.
 */
export function TeamPlan({
  billing,
  situation,
  portal,
  onPortal,
}: {
  billing: Billing;
  situation: PlanSituation;
  portal: Write;
  onPortal: () => void;
}) {
  const manage = (
    label: string,
    testID: string,
    icon?: "external",
  ): ReactNode =>
    portal.around(
      <div>
        <Action
          label={portal.label(label, "Opening…")}
          tone="primary"
          size="md"
          icon={icon}
          write={portal}
          operation="Opening the billing portal"
          disabled={portal.disabled}
          onPress={onPortal}
          testID={testID}
        />
      </div>,
    );
  return (
    <TeamPlanLayout
      alert={
        situation === "past-due" && (
          <StateMessage
            title="Payment failed"
            error
            // Only an owner may open the Portal, so an admin reads the failure
            // and is told below whose action it is rather than offered one the
            // API would refuse.
            action={
              billing.manageable
                ? manage(
                    "Update payment method",
                    "update-payment-method",
                    "external",
                  )
                : undefined
            }
          />
        )
      }
      rows={seatRows(billing, situation)}
      below={
        !billing.manageable ? (
          <p className="fo-copy">{ownerManagesBilling}</p>
        ) : (
          situation !== "past-due" && manage("Manage billing", "manage-billing")
        )
      }
    />
  );
}

/**
 * A workspace with no subscription, and what Team would cost it.
 *
 * A configured price Mokly could not verify against the catalogue leaves the
 * section its title and its way on, and takes away every amount: a number
 * Stripe would not charge is worse than no number, so the plans on the public
 * site are where the reader is sent for one.
 */
export function FreePlan({
  billing,
  checkout,
  onCheckout,
}: {
  billing: Billing;
  checkout: Write;
  onCheckout: () => void;
}) {
  const editor = unitAmount(billing, "editor");
  const collaborator = unitAmount(billing, "collaborator");
  const priced = editor !== undefined && collaborator !== undefined;
  return (
    <div className="fo-stack">
      <StateMessage title="Free for open-source catalogues" icon="project">
        Every project is public.
      </StateMessage>
      <Section title="Team">
        {priced && (
          <Facts
            rows={[
              ["Editor", money(editor) + " a month"],
              ["Collaborator", money(collaborator) + " a month"],
            ]}
          />
        )}
        {priced && (
          <p className="fo-copy">
            {"Team starts with a " + trialDays + "-day trial."}
          </p>
        )}
        {billing.manageable ? (
          checkout.around(
            <div>
              <Action
                label={checkout.label("Upgrade to Team", "Opening…")}
                tone="primary"
                size="md"
                write={checkout}
                operation="Opening checkout"
                disabled={checkout.disabled}
                onPress={onCheckout}
                testID="upgrade-to-team"
              />
            </div>,
          )
        ) : (
          <p className="fo-copy">{ownerManagesBilling}</p>
        )}
        {!priced && <ExternalLink to={site.pricing} label="Pricing" newTab />}
      </Section>
    </div>
  );
}
