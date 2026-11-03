/** Shared comparison mode for the toolbar, inspection, and host markers. */

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

/** Reset the visible mode when the routed owner or index revision changes. */
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
  return (
    <ModeContext
      value={{
        state,
        setState,
        mode: state.ownerKey === ownerKey ? state.mode : "current",
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

/** Read the current shell mode without reading toolbar markup. */
export function useShellComparisonMode(): ComparisonMode {
  return useContext(ModeContext)?.mode ?? "current";
}
