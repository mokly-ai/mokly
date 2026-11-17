import { useCallback, useEffect, useRef, useState } from "react";

import { asApiError, unexpectedError } from "../../api/errors";
import type { ApiError } from "../../api/errors";
import type { Billing, Workspace, Project } from "../../api/types";
import { Action } from "../../components/action";
import { PaneError } from "../../components/resource-state";
import {
  openBillingPortal,
  readBilling,
  startCheckout,
} from "../../data/billing";
import { useResource } from "../../data/use-resource";
import {
  workspaceResourceScope,
  projectResourceScope,
  useInvalidateResources,
} from "../../data/resource-invalidation";
import {
  readQuery,
  useAddressPathname,
  useAddressSearch,
  writeAddress,
} from "../../navigation/address";
import { alwaysSendable, nothingToDo, useWrite } from "../write";
import { planSituation } from "./billing-facts";
import { FreePlan, TeamPlan, TeamPlanWait } from "./billing-plans";

/** How the reader arrived back from a Stripe-hosted Checkout session. */
type Landing = "success" | "cancelled";

/** A successful Checkout return while its webhook catches up. */
type Confirmation = { workspaceId: string } & (
  { state: "confirming" | "delayed" } | { state: "error"; error: ApiError }
);

/** How long the pane waits for the webhook that writes the plan. */
const confirmWindowMs = 30_000;

/** How often it asks again while it waits. */
const confirmIntervalMs = 2_000;

function landingOf(search: string): Landing | undefined {
  const value = readQuery(search).checkout;
  const one = Array.isArray(value) ? value[0] : value;
  return one === "success" || one === "cancelled" ? one : undefined;
}

function withoutCheckout(pathname: string, search: string): string {
  const query = new URLSearchParams(search);
  query.delete("checkout");
  const rest = query.toString();
  return rest.length > 0 ? `${pathname}?${rest}` : pathname;
}

function pause(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

/**
 * Plan, seats and the one way to change them.
 *
 * Every amount is the API's: the read reports both seat counts with the unit
 * amount of the price the deployment verified, and the pane computes the
 * monthly total from them, so no number here is one Stripe has not agreed to.
 * A deployment with no billing configured answers `operation-unavailable`,
 * which is not a failure of this pane — nothing was pressed and nothing was
 * refused — so it says the one thing it knows where its facts would be.
 */
export function BillingPane({
  workspace,
  project,
}: {
  workspace: Workspace;
  project?: Project;
}) {
  const pathname = useAddressPathname();
  const search = useAddressSearch();
  const landing = landingOf(search);
  const address = useRef({ pathname, search });
  address.current = { pathname, search };
  // A success landing owns this pane's reads for its whole lifetime. Keeping
  // the ordinary resource lazy prevents it racing the bounded confirmation.
  const confirmationRead = useRef(
    landing === "success" ? workspace.id : undefined,
  );
  const billing = useResource(
    () => readBilling(workspace.id),
    "billing:" + workspace.id,
    confirmationRead.current !== workspace.id,
  );
  const [confirmation, setConfirmation] = useState<Confirmation | undefined>(
    landing === "success"
      ? { workspaceId: workspace.id, state: "confirming" }
      : undefined,
  );
  const [confirmationRetry, setConfirmationRetry] = useState(0);
  // Taken apart rather than held as one value: the resource object is rebuilt
  // every render, and the confirming effect must not restart with it.
  const { set } = billing;
  const invalidate = useInvalidateResources();
  // A read that reports Team invalidates the workspace and project
  // resources before the pane settles, so switching panes or closing settings
  // uses the reconciled plan without a page reload.
  const acceptRead = useCallback(
    (value: Billing) => {
      set(value);
      if (value.plan !== "team") return;
      invalidate([
        workspaceResourceScope(workspace.id),
        ...(project ? [projectResourceScope(project.id)] : []),
      ]);
    },
    [invalidate, workspace.id, project, set],
  );

  const clearLanding = useCallback(() => {
    const now = address.current;
    if (landingOf(now.search) === undefined) return;
    writeAddress(withoutCheckout(now.pathname, now.search), true);
  }, []);

  // The return from Checkout never writes the plan — only the webhook does —
  // so the pane says what it is doing and asks again until the subscription is
  // confirmed or the bounded wait ends with one more attempt.
  useEffect(() => {
    if (landing === undefined && confirmationRetry === 0) return;
    if (landing === "cancelled") {
      clearLanding();
      return;
    }
    let live = true;
    const settle = async () => {
      const deadline = Date.now() + confirmWindowMs;
      let confirmed = false;
      for (;;) {
        let value: Billing | undefined;
        try {
          value = await readBilling(workspace.id);
        } catch (caught) {
          if (!live) return;
          setConfirmation({
            workspaceId: workspace.id,
            state: "error",
            error: asApiError(caught) ?? unexpectedError(),
          });
          setConfirmationRetry(0);
          clearLanding();
          return;
        }
        if (!live) return;
        acceptRead(value);
        if (value.plan === "team") {
          confirmed = true;
          break;
        }
        if (Date.now() >= deadline) break;
        await pause(confirmIntervalMs);
        if (!live) return;
      }
      if (!live) return;
      setConfirmation(
        confirmed ? undefined : { workspaceId: workspace.id, state: "delayed" },
      );
      setConfirmationRetry(0);
      clearLanding();
    };
    void settle();
    return () => {
      live = false;
    };
  }, [landing, workspace.id, acceptRead, clearLanding, confirmationRetry]);

  const retryConfirmation = useCallback(() => {
    setConfirmation({
      workspaceId: workspace.id,
      state: "confirming",
    });
    setConfirmationRetry((attempt) => attempt + 1);
  }, [workspace.id]);

  const check = useWrite(nothingToDo, alwaysSendable);
  const checkAgain = useCallback(
    () =>
      check.run(async () => {
        const value = await readBilling(workspace.id);
        acceptRead(value);
        setConfirmation(
          value.plan === "team"
            ? undefined
            : { workspaceId: workspace.id, state: "delayed" },
        );
      }),
    [acceptRead, check, workspace.id],
  );

  // A write that opens Stripe's own pages is done when the page leaves for
  // them, so its control stays busy until then.
  const checkout = useWrite(nothingToDo, alwaysSendable);
  const portal = useWrite(nothingToDo, alwaysSendable);
  const upgrade = useCallback(
    () =>
      void checkout.run(async () =>
        checkout.leave(await startCheckout(workspace.id)),
      ),
    [checkout, workspace.id],
  );
  const manage = useCallback(
    () =>
      void portal.run(async () =>
        portal.leave(await openBillingPortal(workspace.id)),
      ),
    [portal, workspace.id],
  );

  const activeConfirmation =
    confirmation?.workspaceId === workspace.id ? confirmation : undefined;
  if (activeConfirmation?.state === "confirming") {
    return <TeamPlanWait label="Confirming your subscription" />;
  }
  if (activeConfirmation?.state === "error") {
    return (
      <PaneError
        title="Billing couldn’t load"
        error={activeConfirmation.error}
        onRetry={retryConfirmation}
      />
    );
  }
  if (activeConfirmation?.state === "delayed") {
    return (
      <section className="review-inline">
        <p className="fo-notice" role="status">
          Still confirming your subscription
        </p>
        {check.around(
          <Action
            label={check.label("Check again", "Checking…")}
            tone="primary"
            size="md"
            write={check}
            operation="Checking your subscription"
            disabled={check.disabled}
            onPress={() => void checkAgain()}
            testID="check-subscription"
          />,
        )}
      </section>
    );
  }
  if (billing.state.status === "loading") {
    return <TeamPlanWait label="Loading billing" />;
  }
  if (billing.state.status === "error") {
    if (billing.state.error.reason === "operation-unavailable") {
      return (
        <section className="fo-notice" role="status">
          Billing opens soon.
        </section>
      );
    }
    return (
      <PaneError
        title="Billing couldn’t load"
        error={billing.state.error}
        onRetry={billing.reload}
      />
    );
  }
  const value = billing.state.value;
  return value.plan === "free" ? (
    <FreePlan billing={value} checkout={checkout} onCheckout={upgrade} />
  ) : (
    <TeamPlan
      billing={value}
      situation={planSituation(value)}
      portal={portal}
      onPortal={manage}
    />
  );
}
