/** React context for optional first-party live host capabilities. */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { ViewerHostCapabilities } from "../client/host_capabilities.js";
import type {
  ViewerCapabilityRequest,
  ViewerCapabilitySource,
} from "../client/host_capability_descriptor.js";
import type { StaticWorkspaceEvidence } from "../standalone/static_workspace_evidence.js";

import type { WorkspaceData } from "./workspace_data.js";

interface ViewerCapabilityContextValue {
  capabilities?: ViewerHostCapabilities;
  initialSource?: ViewerCapabilitySource;
  initialWorkspace?: WorkspaceData;
  staticEvidence?: StaticWorkspaceEvidence;
}

/** Current revision and route-private data accepted by the shell store. */
export interface ViewerLiveState {
  capabilities?: ViewerHostCapabilities;
  request?: ViewerCapabilityRequest;
  workspace?: WorkspaceData;
}

const ViewerCapabilityContext = createContext<ViewerCapabilityContextValue>({});
const ViewerLiveContext = createContext<ViewerLiveState>({});

/** Provider primitive used by standalone and future embedded host composition. */
export function ViewerCapabilityBoundary({
  capabilities,
  children,
  initialSource,
  initialWorkspace,
  staticEvidence,
}: {
  capabilities?: ViewerHostCapabilities;
  children: ReactNode;
  initialSource?: ViewerCapabilitySource;
  initialWorkspace?: WorkspaceData;
  staticEvidence?: StaticWorkspaceEvidence;
}) {
  const [activeCapabilities, setActiveCapabilities] = useState<
    ViewerHostCapabilities | undefined
  >(() => (initialSource ? undefined : capabilities));
  useEffect(() => setActiveCapabilities(capabilities), [capabilities]);
  const value = useMemo(
    () => ({
      ...(activeCapabilities ? { capabilities: activeCapabilities } : {}),
      ...(initialSource ? { initialSource } : {}),
      ...(initialWorkspace ? { initialWorkspace } : {}),
      ...(staticEvidence ? { staticEvidence } : {}),
    }),
    [activeCapabilities, initialSource, initialWorkspace, staticEvidence],
  );
  return (
    <ViewerCapabilityContext.Provider value={value}>
      {children}
    </ViewerCapabilityContext.Provider>
  );
}

/** Read live host services; static export and ordinary React hosts return nothing. */
export function useViewerCapabilities(): ViewerHostCapabilities | undefined {
  return useContext(ViewerCapabilityContext).capabilities;
}

/** Read the descriptor source identically during SSR and hydration. */
export function useViewerInitialSource(): ViewerCapabilitySource | undefined {
  return useContext(ViewerCapabilityContext).initialSource;
}

/** Read route-scoped private evidence identically during SSR and hydration. */
export function useViewerInitialWorkspace(): WorkspaceData | undefined {
  return useContext(ViewerCapabilityContext).initialWorkspace;
}

/** Read inert destination-page evidence only when hydrating static delivery. */
export function useStaticWorkspaceEvidence():
  StaticWorkspaceEvidence | undefined {
  return useContext(ViewerCapabilityContext).staticEvidence;
}

/** Provide the exact adopted source, route and private workspace to descendants. */
export function ViewerLiveBoundary({
  children,
  value,
}: {
  children: ReactNode;
  value: ViewerLiveState;
}) {
  return (
    <ViewerLiveContext.Provider value={value}>
      {children}
    </ViewerLiveContext.Provider>
  );
}

/** Read live store state; static hosts receive an empty value. */
export function useViewerLiveState(): ViewerLiveState {
  return useContext(ViewerLiveContext);
}
