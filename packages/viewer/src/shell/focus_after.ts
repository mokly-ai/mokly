/** Keyboard focus after a recovery action replaces its own button. */

import { useEffect, useState, type RefCallback } from "react";

/** The enabled controls that show: a hidden field of an unset prop is skipped. */
const FIELDS = ["input", "select", "textarea"]
  .map((control) => `${control}:not([hidden]):not(:disabled)`)
  .join(", ");

/**
 * The named elements of one owner and the focus it asked for. After the
 * owner's next commit it focuses the requested element; a named container
 * focuses its first enabled field. When the element is missing, a
 * container has no enabled field, or a focused named element leaves the
 * page, focus moves to the fallback.
 */
export class FocusAfter<Name extends string> {
  readonly #fallback: Name | undefined;
  readonly #elements = new Map<Name, HTMLElement>();
  readonly #callbacks = new Map<Name, RefCallback<HTMLElement>>();
  #requested: Name | undefined;

  constructor(fallback?: Name) {
    this.#fallback = fallback;
  }

  /** Focus the named element after the next commit of the owner. */
  readonly request = (name: Name): void => {
    this.#requested = name;
  };

  /** Attach a named element; the callback is stable for each name. */
  readonly ref = (name: Name): RefCallback<HTMLElement> => {
    const known = this.#callbacks.get(name);
    if (known) return known;
    const callback: RefCallback<HTMLElement> = (element) => {
      const previous = this.#elements.get(name);
      if (element) {
        this.#elements.set(name, element);
        return;
      }
      this.#elements.delete(name);
      if (
        this.#fallback !== undefined &&
        previous !== undefined &&
        previous === previous.ownerDocument.activeElement
      )
        this.#requested = this.#fallback;
    };
    this.#callbacks.set(name, callback);
    return callback;
  };

  /** Run after each commit of the owner: settle the request, if any. */
  commit(): void {
    const name = this.#requested;
    if (name === undefined) return;
    this.#requested = undefined;
    const element = this.#elements.get(name);
    const target = element?.hasAttribute("tabindex")
      ? element
      : element?.querySelector<HTMLElement>(FIELDS);
    const fallback =
      this.#fallback === undefined
        ? undefined
        : this.#elements.get(this.#fallback);
    (target ?? fallback)?.focus();
  }
}

/** One owner's focus requests, settled after each of its commits. */
export function useFocusAfter<Name extends string>(
  fallback?: Name,
): FocusAfter<Name> {
  const [focus] = useState(() => new FocusAfter<Name>(fallback));
  useEffect(() => focus.commit());
  return focus;
}
