/**
 * Keyboard focus after Try again. The button leaves the page when it is
 * pressed, so focus moves to the status that replaces it, and then to the
 * content that replaces the status. Focus moves only while the reader has
 * not moved it: a step that finds focus on another element does nothing.
 */

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type RefCallback,
  type RefObject,
} from "react";

/** Where one recovery is: none, waiting for its status, or for its content. */
type Step = "content" | "status" | undefined;

/**
 * The focus of one Try again. `retry` wraps the action of the button,
 * `status` receives the status that replaces the button, and `content`
 * receives the content that replaces the status. When several elements of
 * the content attach, the first one takes focus.
 */
export class RetryFocus {
  #step: Step;
  #status: HTMLElement | undefined;

  /** Wrap the action of Try again so that its recovery moves focus. */
  retry(action: () => void): () => void;
  retry(action: (() => void) | undefined): (() => void) | undefined;
  retry(action: (() => void) | undefined): (() => void) | undefined {
    if (!action) return undefined;
    return () => {
      this.#step = "status";
      action();
    };
  }

  /** Attach the status that replaces Try again while the content loads. */
  readonly status: RefCallback<HTMLElement> = (element) => {
    if (element) {
      this.#status = element;
      if (this.#step !== "status") return;
      if (focusIsFree(element)) element.focus();
      else this.#step = undefined;
      return;
    }
    const left = this.#status;
    this.#status = undefined;
    // A status that lost focus to the reader passes nothing to the content.
    if (left && left !== left.ownerDocument.activeElement)
      this.#step = undefined;
    else if (this.#step === "status") this.#step = "content";
  };

  /** Attach an element of the content that replaces the status. */
  readonly content: RefCallback<HTMLElement> = (element) => {
    if (!element || this.#step === undefined || this.#status) return;
    this.#step = undefined;
    if (focusIsFree(element)) element.focus();
  };
}

/**
 * Whether focus is on nothing or on the body, as it is after the focused
 * button or status left the page, so that a recovery step may take it.
 */
function focusIsFree(element: HTMLElement): boolean {
  const active = element.ownerDocument.activeElement;
  return active === null || active === element.ownerDocument.body;
}

/** One owner's recovery focus, kept for the owner's lifetime. */
export function useRetryFocus(): RetryFocus {
  const [focus] = useState(() => new RetryFocus());
  return focus;
}

/**
 * The recovery whose content renders below, such as the frames of a stage
 * that replaces its loading state.
 */
export const RetryContent = createContext<RetryFocus | undefined>(undefined);

/** Offer an element of the content to the recovery above, after each commit. */
export function useRetryContent(
  ref: RefObject<HTMLElement | null> | undefined,
): void {
  const recovery = useContext(RetryContent);
  useLayoutEffect(() => {
    if (recovery && ref?.current) recovery.content(ref.current);
  });
}

/**
 * Focus an element that shows both the status and the content, such as a
 * preview frame, and then run the action of Try again.
 */
export function focusThen(
  element: RefObject<HTMLElement | null>,
  action: () => void,
): () => void {
  return () => {
    element.current?.focus();
    action();
  };
}

/**
 * Named refs in which the element of `name` is also offered to `recovery`
 * as its content, such as the heading of the Props panel.
 */
export function useNamedRetryContent<Name extends string>(
  named: (name: Name) => RefCallback<HTMLElement>,
  name: NoInfer<Name>,
  recovery: RetryFocus,
): (name: Name) => RefCallback<HTMLElement> {
  return useMemo(() => {
    const own = named(name);
    const offered: RefCallback<HTMLElement> = (element) => {
      own(element);
      recovery.content(element);
    };
    return (requested) => (requested === name ? offered : named(requested));
  }, [name, named, recovery]);
}
