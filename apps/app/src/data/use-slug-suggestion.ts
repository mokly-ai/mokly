import { useCallback, useEffect, useRef, useState } from "react";

import { asApiError, unexpectedError } from "../api/errors";
import type { ApiError } from "../api/errors";

/** Only the newest asynchronous suggestion may update a form. */
export interface RequestSequence {
  next: () => () => boolean;
  invalidate: () => void;
}

/** Create the generation gate shared by the hook and its race regression test. */
export function createRequestSequence(): RequestSequence {
  let generation = 0;
  return {
    next: () => {
      const current = ++generation;
      return () => current === generation;
    },
    invalidate: () => {
      generation += 1;
    },
  };
}

export type SlugSuggestionState =
  | { status: "idle" | "loading" }
  | { status: "ready"; value: string }
  | { status: "error"; error: ApiError };

/** Values whose precedence keeps automatic updates out of an active edit. */
export interface SuggestedSlugValues {
  automatic: string;
  focused?: string;
  manual?: string;
}

/** Create an untouched suggestion-backed field. */
export function createSuggestedSlugValues(): SuggestedSlugValues {
  return { automatic: "" };
}

/** Retain the newest automatic value behind any focused or manual value. */
export function updateAutomaticSlug(
  values: SuggestedSlugValues,
  automatic: string,
): SuggestedSlugValues {
  return { ...values, automatic };
}

/** Freeze the text the browser actually displayed when interaction began. */
export function focusSuggestedSlug(
  values: SuggestedSlugValues,
  focused: string,
): SuggestedSlugValues {
  return values.manual === undefined ? { ...values, focused } : values;
}

/** Give a manual value permanent ownership, including an empty value. */
export function editSuggestedSlug(
  values: SuggestedSlugValues,
  manual: string,
): SuggestedSlugValues {
  return { automatic: values.automatic, manual };
}

/** Reveal the latest automatic value after an untouched interaction ends. */
export function blurSuggestedSlug(
  values: SuggestedSlugValues,
): SuggestedSlugValues {
  if (values.focused === undefined) return values;
  return values.manual === undefined
    ? { automatic: values.automatic }
    : { automatic: values.automatic, manual: values.manual };
}

/** The value rendered by the controlled input. */
export function suggestedSlugValue(values: SuggestedSlugValues): string {
  return values.manual ?? values.focused ?? values.automatic;
}

/** Read an API-derived slug suggestion and discard every stale response. */
export function useSlugSuggestion(
  source: string,
  load: () => Promise<string>,
): { state: SlugSuggestionState; reload: () => void } {
  const [state, setState] = useState<SlugSuggestionState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(load);
  const sequence = useRef<RequestSequence | undefined>(undefined);
  sequence.current ??= createRequestSequence();
  useEffect(() => {
    latest.current = load;
  });

  useEffect(() => {
    if (source.trim().length === 0) {
      sequence.current?.invalidate();
      setState({ status: "idle" });
      return;
    }
    const isLatest = sequence.current?.next() ?? (() => false);
    setState({ status: "loading" });
    latest
      .current()
      .then((value) => {
        if (isLatest()) setState({ status: "ready", value });
      })
      .catch((caught: unknown) => {
        if (!isLatest()) return;
        setState({
          status: "error",
          error: asApiError(caught) ?? unexpectedError(),
        });
      });
    return () => sequence.current?.invalidate();
  }, [source, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, reload };
}

/**
 * A suggestion-backed field whose manual ownership changes synchronously.
 *
 * Focus snapshots the DOM value into a separate state layer. A suggestion that
 * was already queued before focus may still commit, but remains hidden behind
 * that snapshot and cannot reset the selection before the input event arrives.
 */
export function useSuggestedSlug(
  source: string,
  load: () => Promise<string>,
): {
  value: string;
  edit: (value: string) => void;
  focus: (value: string) => void;
  blur: () => void;
  edited: boolean;
  state: SlugSuggestionState;
  reload: () => void;
} {
  const suggestion = useSlugSuggestion(source, load);
  const [values, setValues] = useState<SuggestedSlugValues>(
    createSuggestedSlugValues,
  );

  useEffect(() => {
    const state = suggestion.state;
    if (state.status === "ready") {
      setValues((current) => updateAutomaticSlug(current, state.value));
    }
    if (state.status === "idle") {
      setValues((current) => updateAutomaticSlug(current, ""));
    }
  }, [suggestion.state]);

  const edit = useCallback(
    (next: string) => setValues((current) => editSuggestedSlug(current, next)),
    [],
  );
  const focus = useCallback(
    (observed: string) =>
      setValues((current) => focusSuggestedSlug(current, observed)),
    [],
  );
  const blur = useCallback(
    () => setValues((current) => blurSuggestedSlug(current)),
    [],
  );
  return {
    ...suggestion,
    value: suggestedSlugValue(values),
    edit,
    focus,
    blur,
    edited: values.manual !== undefined,
  };
}
