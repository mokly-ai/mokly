/** A route's comparison intent: one fact of one route installation. */

import { useEffect, useRef } from "react";

import type { ShellCatalogueReadModel } from "../catalogue/scoped_types.js";

import type { DetailDelivery } from "./data_requests.js";
import { useShellStore } from "./store_context.js";

/**
 * Whether the routed view's comparison eligibility is final: the index
 * classification is complete, and the route's details have arrived or
 * failed. A pending or preparing index can still classify the view, and an
 * arriving detail can still make an affected-only entry eligible.
 */
export function comparisonEligibilityKnown(
  changesStatus: ShellCatalogueReadModel["changesStatus"] | undefined,
  delivery: DetailDelivery,
): boolean {
  return (
    changesStatus !== "pending" &&
    changesStatus !== "preparing" &&
    delivery.status !== "loading" &&
    delivery.status !== "replaced"
  );
}

/**
 * Apply the route's comparison intent once per route installation. When the
 * routed view's eligibility is first known, `select` opens Side by side for
 * an eligible view, and the right panel selects Changes, because only Changes
 * shows a compare mode on the canvas. The store settles the intent either
 * way, so neither an update nor a later eligibility change applies it again,
 * and an intent for an ineligible view leaves the selected tab as it is. The
 * live address is never read.
 */
export function useComparisonIntent(
  eligible: boolean,
  eligibilityKnown: boolean,
  select: () => void,
): void {
  const store = useShellStore();
  const intent = store.state.comparisonIntent
    ? store.state.routeInstallation
    : undefined;
  const latest = useRef({ eligible, select, store });
  latest.current = { eligible, select, store };
  useEffect(() => {
    if (intent === undefined || !eligibilityKnown) return;
    const current = latest.current;
    current.store.settleComparisonIntent(intent);
    if (!current.eligible) return;
    current.select();
    current.store.setPanelTab("changes");
  }, [eligibilityKnown, intent]);
}
