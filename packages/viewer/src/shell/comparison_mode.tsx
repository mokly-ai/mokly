/**
 * The chosen comparison mode, which `useComparison` owns, and the mode that
 * the canvas shows, which host markers and the host's pick follow.
 */

import { createContext, useContext, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

import type { ComparisonMode } from "./comparison_presentation.js";
import { useShellStore } from "./store_context.js";
import { workspaceKey } from "./workspace_entry.js";

interface ModeState {
  mode: ComparisonMode;
  ownerKey: string;
}

interface SharedMode {
  mode: ComparisonMode;
  state: ModeState;
  setState: Dispatch<SetStateAction<ModeState>>;
}

const ModeContext = createContext<SharedMode | undefined>(undefined);

/**
 * Reset the chosen mode when the routed owner or index revision changes. The
 * canvas shows the chosen mode only while Changes is the selected tab, and
 * the current frames while Inspect is.
 */
export function ComparisonModeProvider({ children }: { children: ReactNode }) {
  const store = useShellStore();
  const view = store.state.route.view;
  const owner =
    view.kind === "target"
      ? workspaceKey(store.catalogue, view.target.entry)
      : "";
  const ownerKey = `${owner}\u0000${store.catalogue.publicModel.revision}`;
  const [state, setState] = useState<ModeState>({ mode: "current", ownerKey });
  // Discard a departed workspace's mode before another route can reuse it.
  if (state.ownerKey !== ownerKey) setState({ mode: "current", ownerKey });
  const chosen = state.ownerKey === ownerKey ? state.mode : "current";
  return (
    <ModeContext
      value={{
        state,
        setState,
        mode: store.state.panelTab === "changes" ? chosen : "current",
      }}
    >
      {children}
    </ModeContext>
  );
}

/** The same state useComparison owns, with a local fallback for isolated use. */
export function useComparisonModeState(ownerKey: string) {
  const shared = useContext(ModeContext);
  const [local, setLocal] = useState<ModeState>({ mode: "current", ownerKey });
  return [shared?.state ?? local, shared?.setState ?? setLocal] as const;
}

/** The mode that the canvas shows, without reading the panel's markup. */
export function useShellComparisonMode(): ComparisonMode {
  return useContext(ModeContext)?.mode ?? "current";
}
