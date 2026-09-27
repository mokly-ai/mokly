/** React lifecycle controller for one route's lazy comparison snapshots. */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { useComparisonEnvironment } from "./comparison_context.js";
import {
  renewComparison,
  requestComparison,
  type ComparisonScope,
  type LoadedComparison,
} from "./comparison_request.js";
import { useOptionalShellStore } from "./store_context.js";

/** Available comparison presentations; Current never makes a request. */
export type ComparisonMode = "current" | "side" | "overlay" | "difference";

export interface ComparisonPresentation {
  /** Scheme of the comparison artifact actually shown. */
  colorScheme: "dark" | "light";
  mode: Exclude<ComparisonMode, "current">;
  /** Sticky control selection retained for fallback labels. */
  requestedColorScheme: "dark" | "light";
  viewport: "both" | "desktop" | "mobile";
}

interface Demand extends ComparisonPresentation {
  key: string;
  scope: ComparisonScope;
  scopeKey: string;
}

interface LoadedState {
  scopeKey: string;
  value: LoadedComparison;
}

interface FailureState {
  key: string;
  message: string;
}

interface PendingOperation {
  controller: AbortController;
  scopeKey: string;
}

/** State and actions consumed by the comparison toolbar and pane renderer. */
export interface ComparisonController {
  busy: boolean;
  failure?: string;
  loaded?: LoadedComparison;
  mode: ComparisonMode;
  presentation?: ComparisonPresentation;
  refresh(): void;
  retry(): void;
  selectMode(mode: ComparisonMode): void;
}

/** Keep one request owner across rapid toolbar, viewport, and scheme changes. */
export function useComparison({
  effectiveColorScheme,
  eligible,
  route,
  variantId,
}: {
  effectiveColorScheme?: "dark" | "light";
  eligible: boolean;
  route: string;
  variantId?: string;
}): ComparisonController {
  const store = useOptionalShellStore();
  const environment = useComparisonEnvironment();
  const selection = store?.state.selection;
  const evidenceKey = `${store?.context.updateVersion ?? 0}:${store?.catalogue.publicModel?.revision.evidence ?? 0}`;
  const scope = useMemo<ComparisonScope>(
    () => ({ route, ...(variantId ? { variantId } : {}) }),
    [route, variantId],
  );
  const scopeKey = useMemo(
    () => JSON.stringify([route, variantId]),
    [route, variantId],
  );
  const ownerKey = `${route}\u0000${evidenceKey}`;
  const [modeState, setModeState] = useReducer(
    (
      _current: { mode: ComparisonMode; ownerKey: string },
      next: { mode: ComparisonMode; ownerKey: string },
    ) => next,
    { mode: "current", ownerKey },
  );
  const mode = modeState.ownerKey === ownerKey ? modeState.mode : "current";
  const [loadedState, setLoadedState] = useReducer(
    (_current: LoadedState | undefined, next: LoadedState | undefined) => next,
    undefined,
  );
  const [presentation, setPresentation] = useReducer(
    (
      _current: (ComparisonPresentation & { scopeKey: string }) | undefined,
      next: (ComparisonPresentation & { scopeKey: string }) | undefined,
    ) => next,
    undefined,
  );
  const [failure, setFailure] = useReducer(
    (_current: FailureState | undefined, next: FailureState | undefined) =>
      next,
    undefined,
  );
  const [busy, toggleBusy] = useReducer(
    (_current: boolean, next: boolean) => next,
    false,
  );
  const loadedRef = useRef<LoadedState | undefined>(undefined);
  const failureRef = useRef<FailureState | undefined>(undefined);
  const pendingRef = useRef<PendingOperation | undefined>(undefined);
  const completedRef = useRef<string | undefined>(undefined);
  const latestDemand = useRef<Demand | undefined>(undefined);
  const currentOwner = useRef(ownerKey);
  const currentEligibility = useRef(eligible);
  currentOwner.current = ownerKey;
  currentEligibility.current = eligible;
  const demand =
    eligible && mode !== "current"
      ? comparisonDemand(
          scope,
          scopeKey,
          mode,
          selection?.viewport ?? "both",
          effectiveColorScheme ?? selection?.colorScheme ?? "light",
          selection?.colorScheme ?? "light",
        )
      : undefined;
  latestDemand.current = demand;

  const begin = useCallback(
    (kind: "load" | "renew", refresh = false) => {
      const requested = latestDemand.current;
      if (!requested || !environment) return;
      pendingRef.current?.controller.abort();
      const controller = new AbortController();
      const operation = { controller, scopeKey: requested.scopeKey };
      pendingRef.current = operation;
      failureRef.current = undefined;
      setFailure(undefined);
      toggleBusy(true);
      const current = loadedRef.current;
      const work =
        kind === "renew" && current?.scopeKey === requested.scopeKey
          ? renewComparison(
              environment,
              current.value,
              requested.scope,
              controller.signal,
            )
          : requestComparison(
              environment,
              requested.scope,
              refresh,
              controller.signal,
            );
      void work.then(
        (value) => {
          const latest = latestDemand.current;
          if (
            controller.signal.aborted ||
            pendingRef.current !== operation ||
            !latest ||
            latest.scopeKey !== operation.scopeKey
          )
            return;
          const nextLoaded = { scopeKey: latest.scopeKey, value };
          loadedRef.current = nextLoaded;
          completedRef.current = latest.key;
          setLoadedState(nextLoaded);
          setPresentation({
            scopeKey: latest.scopeKey,
            colorScheme: latest.colorScheme,
            mode: latest.mode,
            requestedColorScheme: latest.requestedColorScheme,
            viewport: latest.viewport,
          });
          pendingRef.current = undefined;
          toggleBusy(false);
        },
        (error: unknown) => {
          if (controller.signal.aborted || pendingRef.current !== operation)
            return;
          pendingRef.current = undefined;
          const latest = latestDemand.current;
          if (!latest || latest.scopeKey !== operation.scopeKey) return;
          const nextFailure = {
            key: latest.key,
            message: environment.reportError
              ? "Comparison unavailable"
              : error instanceof Error
                ? error.message
                : "Comparison unavailable",
          };
          loadedRef.current = undefined;
          failureRef.current = nextFailure;
          completedRef.current = undefined;
          setLoadedState(undefined);
          setPresentation(undefined);
          setFailure(nextFailure);
          toggleBusy(false);
          environment.reportError?.(error);
        },
      );
    },
    [environment],
  );

  useEffect(() => {
    setModeState({
      ownerKey: currentOwner.current,
      mode:
        currentEligibility.current && environment?.initialMode?.() === "side"
          ? "side"
          : "current",
    });
  }, [eligible, environment, route]);

  useEffect(() => {
    if (!eligible) setModeState({ ownerKey, mode: "current" });
  }, [eligible, ownerKey]);

  useEffect(() => {
    if (!demand || !environment) {
      pendingRef.current?.controller.abort();
      pendingRef.current = undefined;
      loadedRef.current = undefined;
      failureRef.current = undefined;
      completedRef.current = undefined;
      setLoadedState(undefined);
      setPresentation(undefined);
      setFailure(undefined);
      toggleBusy(false);
      return;
    }
    const pending = pendingRef.current;
    if (pending?.scopeKey === demand.scopeKey) return;
    if (pending) {
      pending.controller.abort();
      pendingRef.current = undefined;
    }
    if (failureRef.current?.key === demand.key) return;
    if (completedRef.current === demand.key) return;
    const loaded = loadedRef.current;
    begin(loaded?.scopeKey === demand.scopeKey ? "renew" : "load");
  }, [begin, demand?.key, demand?.scopeKey]);

  useEffect(
    () => () => {
      pendingRef.current?.controller.abort();
      pendingRef.current = undefined;
    },
    [],
  );

  const currentLoaded =
    loadedState?.scopeKey === scopeKey ? loadedState.value : undefined;
  const currentPresentation =
    presentation?.scopeKey === scopeKey ? presentation : undefined;
  const currentFailure =
    failure && failure.key === demand?.key ? failure.message : undefined;
  return {
    busy,
    mode,
    ...(currentFailure ? { failure: currentFailure } : {}),
    ...(demand && currentLoaded ? { loaded: currentLoaded } : {}),
    ...(demand && currentPresentation
      ? { presentation: currentPresentation }
      : {}),
    refresh: () => begin("load", true),
    retry: () => begin("load", true),
    selectMode: (next) => setModeState({ mode: next, ownerKey }),
  };
}

function comparisonDemand(
  scope: ComparisonScope,
  scopeKey: string,
  mode: Exclude<ComparisonMode, "current">,
  viewport: ComparisonPresentation["viewport"],
  colorScheme: ComparisonPresentation["colorScheme"],
  requestedColorScheme: ComparisonPresentation["requestedColorScheme"],
): Demand {
  return {
    scope,
    scopeKey,
    mode,
    viewport,
    colorScheme,
    requestedColorScheme,
    key: JSON.stringify([
      scopeKey,
      mode,
      viewport,
      colorScheme,
      requestedColorScheme,
    ]),
  };
}
