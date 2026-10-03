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
import type {
  InteractivePrepareResponse,
  ViewerInteractiveDescriptor,
} from "../client/interactive_capability.js";
import type { RebuildStatus } from "../client/rebuild_status.js";
import type { StaticWorkspaceEvidence } from "../standalone/static_workspace_evidence.js";

import type { WorkspaceData } from "./workspace_data.js";

interface ViewerCapabilityContextValue {
  capabilities?: ViewerHostCapabilities;
  initialSource?: ViewerCapabilitySource;
  initialInteractive?: ViewerInteractiveDescriptor;
  initialRebuildStatus?: RebuildStatus;
  initialWorkspace?: WorkspaceData;
  staticEvidence?: StaticWorkspaceEvidence;
}

/** Current revision and route-private data accepted by the shell store. */
export interface ViewerLiveState {
  /** Record a completed preparation for the installed Live generation. */
  adoptPreparation?(result: InteractivePrepareResponse): void;
  capabilities?: ViewerHostCapabilities;
  interactive?: ViewerInteractiveDescriptor;
  /** Latest validated private watched-Serve status whose source fence is installed. */
  rebuildStatus?: RebuildStatus;
  request?: ViewerCapabilityRequest;
  routeEvidence?: ViewerRouteEvidenceState;
  workspace?: WorkspaceData;
  /**
   * The routed screen or component's private workspace is still expected:
   * set from same-shell navigation until it is adopted, and cleared if its
   * request settles without one, which leaves private evidence unknown.
   */
  workspacePending?: true;
}

/** Route-owned public/private evidence delivery exposed to workspace UI. */
export interface ViewerRouteEvidenceState {
  status: "failed" | "loading" | "ready";
  retry(): void;
}

const ViewerCapabilityContext = createContext<ViewerCapabilityContextValue>({});
const ViewerLiveContext = createContext<ViewerLiveState>({});

/** Provider primitive used by standalone and future embedded host composition. */
export function ViewerCapabilityBoundary({
  capabilities,
  children,
  initialInteractive,
  initialRebuildStatus,
  initialSource,
  initialWorkspace,
  staticEvidence,
}: {
  capabilities?: ViewerHostCapabilities;
  children: ReactNode;
  initialSource?: ViewerCapabilitySource;
  initialInteractive?: ViewerInteractiveDescriptor;
  initialRebuildStatus?: RebuildStatus;
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
      ...(initialInteractive ? { initialInteractive } : {}),
      ...(initialRebuildStatus ? { initialRebuildStatus } : {}),
      ...(initialWorkspace ? { initialWorkspace } : {}),
      ...(staticEvidence ? { staticEvidence } : {}),
    }),
    [
      activeCapabilities,
      initialInteractive,
      initialRebuildStatus,
      initialSource,
      initialWorkspace,
      staticEvidence,
    ],
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

/** Read the private Live listener state identically during SSR and hydration. */
export function useViewerInitialInteractive():
  ViewerInteractiveDescriptor | undefined {
  return useContext(ViewerCapabilityContext).initialInteractive;
}

/** Read private rebuild status identically during server rendering and hydration. */
export function useViewerInitialRebuildStatus(): RebuildStatus | undefined {
  return useContext(ViewerCapabilityContext).initialRebuildStatus;
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
