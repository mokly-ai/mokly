import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useLayoutEffect,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

import { createDrafts } from "./drafts";
import type { Drafts } from "./drafts";

const DirtyContext = createContext<Drafts | undefined>(undefined);

/**
 * Holds what the reader has typed into settings and not yet saved, for both
 * presentations at once, so a pane that leaves the screen does not take the
 * reader's words with it.
 *
 * The record lives outside React state: a keystroke and the Escape that
 * follows it can land in the same frame, and a guard that waited for a render
 * would still be reading the previous answer.
 */
export function DirtyProvider({ children }: { children: ReactNode }) {
  const drafts = useRef<Drafts | undefined>(undefined);
  drafts.current ??= createDrafts();
  return (
    <DirtyContext.Provider value={drafts.current}>
      {children}
    </DirtyContext.Provider>
  );
}

/** The surface's view of everything the reader has typed and not saved. */
export function useDirtyState(): Drafts {
  const value = useContext(DirtyContext);
  if (!value) {
    throw new Error("[app/settings] useDirtyState used outside DirtyProvider");
  }
  return value;
}

/**
 * One field of one pane, reading what the reader last typed rather than what
 * the pane mounted with.
 *
 * `saved` is what the field would say if nothing were pending, and it moves
 * when the server answers a save; `alsoClean` names any other text that would
 * cost the reader nothing to lose, such as a confirmation that already says
 * what it confirms. Whether the field holds a draft is that comparison, made
 * afresh, so a save settles it without the pane having to reset anything.
 */
export function useDraft(
  field: string,
  saved: string,
  alsoClean?: readonly string[],
  comparison: "trimmed" | "exact" = "trimmed",
): [string, (next: string) => void] {
  const drafts = useDirtyState();
  const held = useSyncExternalStore(
    drafts.watch,
    () => drafts.held(field),
    () => undefined,
  );
  // Serialised so the effect depends on the values rather than on the
  // array's identity, which a pane rebuilds on every render.
  const extra = JSON.stringify(alsoClean ?? []);
  useLayoutEffect(() => {
    drafts.measure(
      field,
      saved,
      JSON.parse(extra) as readonly string[],
      comparison,
    );
  }, [drafts, field, saved, extra, comparison]);
  const set = useCallback(
    (next: string) => drafts.hold(field, next),
    [drafts, field],
  );
  return [held ?? saved, set];
}
