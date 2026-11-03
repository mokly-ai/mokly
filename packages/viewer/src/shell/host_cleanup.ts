/** Frame cleanup that runs the code of a host's frame adapter. */

import { createContext, useContext } from "react";

type Mark = (error: unknown) => void;

/**
 * Records a value that the host's frame adapter threw, so the catcher passes
 * it to the host. It is absent for the viewer's own adapter and in the
 * standalone shell, where such a value is a viewer failure.
 */
export const HostCleanupMark = createContext<Mark | undefined>(undefined);

/** The mark for the frames that use the root's adapter. */
export function useHostCleanupMark(): Mark | undefined {
  return useContext(HostCleanupMark);
}

/** Run one adapter cleanup. A value that it throws is marked, then rethrown. */
export function hostCleanup(cleanup: () => void, mark: Mark | undefined): void {
  try {
    cleanup();
  } catch (error) {
    mark?.(error);
    throw error;
  }
}
