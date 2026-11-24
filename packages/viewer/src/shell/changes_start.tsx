/**
 * The host's `changesStart` slot: content that the Changes tab of the right
 * panel shows after the change stepper, under the
 * [Changes tab](../../../../docs/protocol/mokly-changes-controls.md#changes-tab).
 * The shell passes the content to the tab and never reads it.
 */

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

const ChangesStartContext = createContext<ReactNode>(undefined);

/** Give the shell below the host's content for the Changes tab. */
export function ChangesStartProvider({
  children,
  content,
}: {
  children: ReactNode;
  /** The slot's content; absent for an empty slot, which takes no space. */
  content?: ReactNode;
}) {
  return <ChangesStartContext value={content}>{children}</ChangesStartContext>;
}

/** The host's content for the Changes tab, or nothing for an empty slot. */
export function useChangesStart(): ReactNode {
  return useContext(ChangesStartContext);
}
