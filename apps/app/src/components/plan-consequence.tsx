import type { ReactNode } from "react";

import { askAnOwnerToUpgrade } from "../api/labels";
import { PaneLink } from "../settings/pane-link";
import { Action } from "./action";
import type { ActionTone } from "./action";

/** The role-dependent pieces a surface places in its own composition. */
export interface PlanConsequenceParts {
  /** The owner's way into Billing. */
  action: ReactNode | undefined;
  /** What everyone else can do instead. */
  message: string | undefined;
}

type BillingTarget =
  | { to: "billing"; onOpenBilling?: never; testID?: never }
  | { to?: never; onOpenBilling: () => void; testID?: string };

type PlanConsequenceProps = BillingTarget & {
  sentence?: string;
  canUpgrade: boolean;
  tone?: ActionTone;
  size?: "sm" | "md" | "lg";
  children?: (parts: PlanConsequenceParts) => ReactNode;
};

/**
 * One plan consequence and its role rule: an owner opens Billing, while every
 * other reader is told to ask one. A surface may place those shared pieces in
 * its own established composition without rewriting the policy or its copy.
 */
export function PlanConsequence({
  sentence,
  canUpgrade,
  tone,
  size = "sm",
  testID,
  to,
  onOpenBilling,
  children,
}: PlanConsequenceProps) {
  const action = canUpgrade ? (
    to === "billing" ? (
      <PaneLink label="Open billing" to="billing" tone={tone} size={size} />
    ) : (
      <Action
        label="Open billing"
        tone={tone}
        size={size}
        onPress={onOpenBilling}
        testID={testID}
      />
    )
  ) : undefined;
  const message = canUpgrade ? undefined : askAnOwnerToUpgrade;
  const parts = { action, message };
  if (children) return children(parts);
  return (
    <div className="review-inline">
      {sentence && <p className="fo-copy">{sentence}</p>}
      {action}
      {message && <p className="fo-copy">{message}</p>}
    </div>
  );
}
