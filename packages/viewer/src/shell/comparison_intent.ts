/** A route's comparison intent: one fact of one route installation. */

import { useEffect, useRef } from "react";

import type { ShellCatalogueReadModel } from "../catalogue/scoped_types.js";

import type { DetailDelivery } from "./data_requests.js";
import { useOptionalShellStore } from "./store_context.js";

/**
 * Whether the routed view's comparison eligibility is final: the index
 * classification is complete, and the routed entry's detail has arrived or
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
    delivery.status !== "loading"
  );
}

/**
 * Apply the route's comparison intent once per route installation. When the
 * routed view's eligibility is first known, `select` opens Side by side for
 * an eligible view, and the store settles the intent either way, so neither
 * an update nor a later eligibility change applies it again. The live address
 * is never read.
 */
export function useComparisonIntent(
  eligible: boolean,
  eligibilityKnown: boolean,
  select: () => void,
): void {
  const store = useOptionalShellStore();
  const intent = store?.state.comparisonIntent
    ? store.state.routeInstallation
    : undefined;
  const latest = useRef({ eligible, select, store });
  latest.current = { eligible, select, store };
  useEffect(() => {
    if (intent === undefined || !eligibilityKnown) return;
    latest.current.store?.settleComparisonIntent(intent);
    if (latest.current.eligible) latest.current.select();
  }, [eligibilityKnown, intent]);
}
