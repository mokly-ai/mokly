import { createContext, useContext, type ReactNode } from "react";

import type { Appearance } from "../../../../../../packages/ui/src/appearance-selector/appearance-selector.js";
import type { EmptyStateRoot } from "../../../../../../packages/ui/src/empty-state/empty-state.js";

const Root = createContext<Appearance | undefined>(undefined);

/**
 * The documented shared context of the preview group: a page that the shell
 * draws before it has a catalogue tells the empty state in it that it takes
 * the place of the standalone viewer root, with the root's appearance, as the
 * shell's loading, failure, and version states do.
 */
export function RootPlacementScope({
  children,
  theme,
}: {
  children?: ReactNode;
  theme: Appearance;
}) {
  return <Root value={theme}>{children}</Root>;
}

/** The viewer root that a depicted state takes the place of, if any. */
export function useRootPlacement(): EmptyStateRoot | undefined {
  const theme = useContext(Root);
  return theme === undefined ? undefined : { kind: "standalone", theme };
}
