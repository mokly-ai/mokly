/** React lifecycle controller for one entry's lazy comparison snapshots. */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { useComparisonEnvironment } from "./comparison_context.js";
import {
  comparisonDemand,
  type ComparisonDemand,
  type ComparisonMode,
  type ComparisonPresentation,
} from "./comparison_presentation.js";
import {
  renewComparison,
  requestComparison,
  type ComparisonScope,
  type LoadedComparison,
} from "./comparison_request.js";
import { useOptionalShellStore } from "./store_context.js";
import { useComparisonMode } from "./use_comparison_mode.js";
import { useActiveWorkspace } from "./workspace_context.js";

export type {
  ComparisonMode,
  ComparisonPresentation,
} from "./comparison_presentation.js";

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
  entryId,
  owner,
}: {
  effectiveColorScheme?: "dark" | "light";
  eligible: boolean;
  entryId: string;
  owner?: string;
}): ComparisonController {
  const store = useOptionalShellStore();
  const environment = useComparisonEnvironment();
  const workspace = useActiveWorkspace();
  const selection = store?.state.selection;
  const evidenceRevision = store?.catalogue.publicModel?.revision.evidence ?? 0;
  const scope = useMemo<ComparisonScope>(() => ({ id: entryId }), [entryId]);
  const scopeKey = useMemo(() => JSON.stringify([entryId]), [entryId]);
  const { mode, selectMode } = useComparisonMode({
    available:
      environment !== undefined && (workspace?.initialModeReady ?? true),
    eligible,
    initialMode: environment?.initialMode?.(),
    ownerKey: owner ?? entryId,
    updateVersion: store?.context.updateVersion ?? 0,
  });
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
  const latestDemand = useRef<ComparisonDemand | undefined>(undefined);
  const acceptedEvidence = useRef(evidenceRevision);
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

  useEffect(() => {
    if (acceptedEvidence.current === evidenceRevision) return;
    acceptedEvidence.current = evidenceRevision;
    const requested = latestDemand.current;
    if (
      requested &&
      loadedRef.current?.scopeKey === requested.scopeKey &&
      !pendingRef.current &&
      environment?.delivery().kind === "live"
    )
      begin("renew");
  }, [begin, environment, evidenceRevision]);

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
    selectMode,
  };
}
