/** What the reader has typed into settings, and what it would be measured against. */
export interface Drafts {
  /** Whether anything unsaved would be lost, asked when the question matters. */
  isDirty: () => boolean;
  /** What the reader typed into one field, if they have typed in it at all. */
  held: (field: string) => string | undefined;
  /** Remember what the reader typed. */
  hold: (field: string, draft: string) => void;
  /** Forget one saved, discarded or superseded field. */
  forget: (field: string) => void;
  /**
   * What the field would have to say to cost the reader nothing: the saved
   * value first, then any other text that would lose nothing — a confirmation
   * that already says what it confirms. Text matching the saved value is
   * forgotten, so a field shows what was saved once it has been.
   */
  measure: (
    field: string,
    saved: string,
    alsoClean?: readonly string[],
    comparison?: "trimmed" | "exact",
  ) => void;
  /** Forget everything, after the reader chooses to discard or leaves. */
  clear: () => void;
  /** Hear about every change, so a pane can redraw and a guard can go up. */
  watch: (listener: () => void) => () => void;
}

/** A draft key that names the thing the field belongs to as well as the field. */
export function draftKey(kind: string, subject: string, field: string): string {
  return `${kind}:${subject}:${field}`;
}

/** Text is compared the way the panes submit it, so spacing is never a draft. */
function same(one: string, other: string, exact: boolean): boolean {
  return exact ? one === other : one.trim() === other.trim();
}

/**
 * One record of what the reader has typed into settings, which the surface
 * asks before it closes so Escape, the backdrop, Close and Back all reach the
 * same confirmation instead of each pane defending its own form.
 *
 * Whether something would be lost is a comparison, never a remembered verdict:
 * each field says what it holds and what that would have to equal to cost
 * nothing, and a saved value that comes back from the server settles the field
 * without anyone having to remember to reset it.
 *
 * It is one record rather than one per surface because settings is one system
 * with two presentations: a pane that leaves the screen because the reader
 * switched panes, or because a tablet was rotated across the breakpoint and
 * the dialog took over from the full-screen layer, has not been abandoned, and
 * what the reader typed is still theirs when they come back. Saving,
 * discarding and leaving settings forget it.
 */
export function createDrafts(): Drafts {
  const held = new Map<string, string>();
  const clean = new Map<
    string,
    { values: readonly string[]; exact: boolean }
  >();
  const listeners = new Set<() => void>();
  const announce = () => {
    for (const listener of listeners) listener();
  };
  const costly = (field: string, text: string) => {
    const against = clean.get(field) ?? { values: [""], exact: false };
    return !against.values.some((value) => same(text, value, against.exact));
  };
  return {
    isDirty: () => {
      for (const [field, text] of held) if (costly(field, text)) return true;
      return false;
    },
    held: (field) => held.get(field),
    hold: (field, draft) => {
      if (held.get(field) === draft) return;
      held.set(field, draft);
      announce();
    },
    forget: (field) => {
      if (!held.delete(field)) return;
      announce();
    },
    measure: (field, saved, alsoClean = [], comparison = "trimmed") => {
      const exact = comparison === "exact";
      clean.set(field, { values: [saved, ...alsoClean], exact });
      const text = held.get(field);
      // Once the field says what was saved there is nothing to keep, so the
      // pane goes back to showing the saved value rather than the reader's
      // spacing around it.
      if (text !== undefined && same(text, saved, exact)) held.delete(field);
      announce();
    },
    clear: () => {
      if (held.size === 0) return;
      held.clear();
      announce();
    },
    watch: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
