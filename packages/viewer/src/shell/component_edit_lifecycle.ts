/**
 * The lifecycle rules of live prop edits, outside React: the debounce, one
 * active render per edit owner, cancellation, the revision fence on results,
 * and the rerender after a context or capability change.
 */

import type { ComponentRenderSuccess } from "../components/render_types.js";
import type { GeneratedComponentView } from "../components/views.js";

import { controlViewKey } from "./component_controls_state.js";
import type { TemporaryPreviews } from "./data_context.js";

/** Text and number edits wait this long; boolean and select edits do not. */
export const EDIT_DEBOUNCE_MS = 150;

/** One render the owner started; it stays current until the next cancel. */
export interface EditOperation {
  readonly signal: AbortSignal;
  current(): boolean;
}

/**
 * One edit owner's pending and active render. A new edit, navigation,
 * reset, a context change and unmount cancel both, so a superseded render
 * never settles the editor and cancellation never leaves a loading state.
 */
export class EditLifecycle {
  #timer: ReturnType<typeof setTimeout> | undefined;
  #active: AbortController | undefined;
  #sequence = 0;

  /** Submit now, or after the debounce; an earlier pending submit is dropped. */
  schedule(immediate: boolean, submit: () => void): void {
    this.cancel();
    if (immediate) submit();
    else this.#timer = setTimeout(submit, EDIT_DEBOUNCE_MS);
  }

  /** Start one render; it is current until the next `cancel` or `begin`. */
  begin(): EditOperation {
    this.#active?.abort();
    const controller = new AbortController();
    const operation = this.#sequence;
    this.#active = controller;
    return {
      signal: controller.signal,
      current: () => !controller.signal.aborted && operation === this.#sequence,
    };
  }

  /** Drop the pending submit and abort the active render. */
  cancel(): void {
    this.#sequence += 1;
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#active?.abort();
    this.#active = undefined;
  }
}

/** A render result is accepted only for the installed revision. */
export function acceptedRender(
  results: readonly (readonly [string, ComponentRenderSuccess])[],
  installed: TemporaryPreviews | undefined,
): boolean {
  return (
    installed !== undefined &&
    results.every(([, result]) => result.revision === installed.revision)
  );
}

/**
 * The identity of the views an edit renders and of the capability that
 * renders them: a revision adoption or a `live.generation` change alters it.
 */
export function editContextKey(
  contexts: readonly GeneratedComponentView[],
  previews: TemporaryPreviews | undefined,
): string {
  return `${contexts.map(controlViewKey).join("|")}\u0000${
    previews?.generation ?? ""
  }/${previews?.revision ?? ""}`;
}

/**
 * Rerender the current edited props when the views or the capability
 * changed, so a 409 or a new render generation recovers without a new edit.
 */
export function shouldRerender(
  previousKey: string,
  key: string,
  dirty: boolean,
  editable: boolean,
): boolean {
  return previousKey !== key && dirty && editable;
}
