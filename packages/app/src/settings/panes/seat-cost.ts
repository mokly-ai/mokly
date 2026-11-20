import type { Billing, Workspace } from "../../api/types";
import { readBilling } from "../../data/billing";
import { useResource } from "../../data/use-resource";

/**
 * What the workspace's seats cost, for the invitation form adding one.
 *
 * The bill is the material consequence of inviting somebody, so the control
 * that makes the write names the seat it adds and its price. Only a Team
 * workspace pays for seats and only an owner or an admin may read billing,
 * so the read is made under exactly those conditions and the sentence is
 * simply absent otherwise — never a price this pane made up.
 */
export function useSeatCosts(
  workspace: Workspace | undefined,
): Billing | undefined {
  const administers =
    workspace?.role === "owner" || workspace?.role === "admin";
  const billing = useResource(
    () => readBilling(workspace?.id ?? ""),
    "seat-costs:" + (workspace?.id ?? ""),
    administers && workspace?.plan === "team",
  );
  return billing.state.status === "ready" ? billing.state.value : undefined;
}
