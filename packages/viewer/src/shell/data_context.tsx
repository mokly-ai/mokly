/** React access to the routed detail delivery and the live render capability. */

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type {
  ComponentRenderRequest,
  ComponentRenderSuccess,
} from "../components/render_types.js";

import type { DetailDelivery } from "./data_requests.js";
import type { ShellDataStore } from "./data_store.js";

/** The temporary previews of the live render capability. */
export interface TemporaryPreviews {
  /** The descriptor generation that owns this capability. */
  generation: string;
  /** The index revision a render request must carry. */
  revision: number;
  /** The deployment the capability belongs to. */
  deploymentId: string;
  render(
    request: Omit<ComponentRenderRequest, "revision">,
    signal: AbortSignal,
  ): Promise<ComponentRenderSuccess>;
  expired(previewUrl: string, signal: AbortSignal): Promise<boolean>;
}

/** Behaviour the standalone shell builds in the browser from Serve JSON. */
export interface ViewerCapabilities {
  temporaryPreviews: TemporaryPreviews;
}

/** Live prop editing in Serve before its capability installs. */
export type LiveEditingStart =
  { status: "preparing" } | { status: "failed"; retry(): void };

interface ShellDataContextValue {
  capabilities?: ViewerCapabilities;
  editingStart?: LiveEditingStart;
  routeDelivery?: DetailDelivery;
}

const ShellDataContext = createContext<ShellDataContextValue>({});

/** Provide one shell root's detail delivery and live capability. */
export function ShellDataBoundary({
  children,
  store,
}: {
  children: ReactNode;
  store: ShellDataStore;
}) {
  const { descriptor, editing, retry, source } = store.live;
  const index = store.snapshot.index;
  const capabilities = useMemo<ViewerCapabilities | undefined>(() => {
    if (!descriptor || !source) return undefined;
    const revision = index.revision;
    return {
      temporaryPreviews: {
        generation: descriptor.generation,
        revision,
        deploymentId: index.deploymentId,
        render: (request, signal) =>
          source.render(descriptor, { ...request, revision }, signal),
        expired: (previewUrl, signal) =>
          source.previewExpired(previewUrl, signal),
      },
    };
  }, [descriptor, index.deploymentId, index.revision, source]);
  const editingStart = useMemo<LiveEditingStart | undefined>(
    () =>
      capabilities || !editing || editing === "ready"
        ? undefined
        : editing === "failed"
          ? { status: "failed", retry }
          : { status: "preparing" },
    [capabilities, editing, retry],
  );
  const value = useMemo(
    () => ({
      ...(capabilities ? { capabilities } : {}),
      ...(editingStart ? { editingStart } : {}),
      ...(store.routeDelivery ? { routeDelivery: store.routeDelivery } : {}),
    }),
    [capabilities, editingStart, store.routeDelivery],
  );
  return <ShellDataContext value={value}>{children}</ShellDataContext>;
}

/**
 * The live render capability in the standalone shell of Serve; `undefined`
 * in a static build and in an embedded React host.
 */
export function useViewerCapabilities(): ViewerCapabilities | undefined {
  return useContext(ShellDataContext).capabilities;
}

/**
 * Live prop editing that waits for, or failed to load, its descriptor in
 * Serve; `undefined` once the capability installs and outside Serve.
 */
export function useLiveEditingStart(): LiveEditingStart | undefined {
  return useContext(ShellDataContext).editingStart;
}

/** The delivery of the route's details; absent on home and missing routes. */
export function useRouteDelivery(): DetailDelivery | undefined {
  return useContext(ShellDataContext).routeDelivery;
}
