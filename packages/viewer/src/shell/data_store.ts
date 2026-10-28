/** React ownership of one shell root's data controller. */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { LiveDescriptorV3 } from "../catalogue/types.js";
import type { MoklyVersionError } from "../catalogue/version_error.js";

import {
  shellStateWithCatalogue,
  type ShellDataSnapshot,
} from "./data_commit.js";
import { ShellDataController } from "./data_controller.js";
import type { LiveEditingStatus } from "./data_descriptor.js";
import {
  routeDetailDelivery,
  routeDetailRequests,
  routeKey,
  type DetailDelivery,
} from "./data_requests.js";
import type { ShellDataSource, ShellLiveSource } from "./data_source.js";
import type { ShellState } from "./store_state.js";

/** The installed render capability of Serve and how live editing stands. */
export interface ShellLiveState {
  descriptor: LiveDescriptorV3 | undefined;
  /** Ready, preparing, or failed while the index is live; absent elsewhere. */
  editing: LiveEditingStatus | undefined;
  /** Load the descriptor again after its load failed. */
  retry(): void;
  source: ShellLiveSource | undefined;
}

/** The data one shell root renders from, with the routed entry's delivery. */
export interface ShellDataStore {
  snapshot: ShellDataSnapshot;
  routeDelivery: DetailDelivery | undefined;
  live: ShellLiveState;
}

interface Current<T> {
  current: T;
}

/** Fetch the routed entry's details under their fences and adopt publications. */
export function useShellDataStore(input: {
  initial: ShellDataSnapshot;
  interactive: boolean;
  onVersionError?: ((error: MoklyVersionError) => void) | undefined;
  setState: Dispatch<SetStateAction<ShellState>>;
  source: ShellDataSource | undefined;
  state: ShellState;
  stateRef: Current<ShellState>;
}): ShellDataStore {
  const latest = useRef(input);
  latest.current = input;
  const [controller] = useState(
    () =>
      new ShellDataController(input.initial, input.source, {
        commit(next) {
          const current = latest.current;
          const state = shellStateWithCatalogue(
            current.stateRef.current,
            next.catalogue,
          );
          current.stateRef.current = state;
          current.setState(state);
        },
        route: () => latest.current.stateRef.current.route,
        versionError: (error) => latest.current.onVersionError?.(error),
        warn: (message, cause) => console.warn(message, cause),
      }),
  );
  const version = useSyncExternalStore(
    controller.subscribe,
    controller.version,
    controller.version,
  );
  const snapshot = controller.snapshot;
  const requests = useMemo(
    () => routeDetailRequests(snapshot.index, input.state.route),
    [snapshot.index, input.state.route],
  );

  useEffect(() => {
    if (!input.interactive) return;
    controller.request(requests);
  }, [controller, input.interactive, requests]);
  useEffect(() => () => controller.abortLoads(), [controller]);
  useEffect(() => {
    if (input.interactive) return controller.connect();
  }, [controller, input.interactive]);

  const failed = controller.failed;
  const refreshFailed = controller.refreshFailed;
  const replaced = controller.replaced;
  const routeDelivery = useMemo<DetailDelivery | undefined>(
    () =>
      routeDetailDelivery({
        details: snapshot.details,
        failed,
        refreshFailed: refreshFailed === routeKey(input.state.route),
        replaced,
        requests,
        retry: (keys) => controller.retry(keys),
        retryRefresh: controller.retryRefresh,
      }),
    [
      controller,
      failed,
      input.state.route,
      refreshFailed,
      replaced,
      requests,
      snapshot.details,
    ],
  );
  const descriptor = controller.descriptor;
  const editing = controller.editing;
  const live = useMemo<ShellLiveState>(
    () => ({
      descriptor,
      editing,
      retry: controller.retryDescriptor,
      source: controller.live,
    }),
    [controller, descriptor, editing, version],
  );
  return { snapshot, routeDelivery, live };
}
