// @ts-check
/* global document, window */

/**
 * The scheme island: it applies the reader's color scheme before the first
 * paint and runs the footer's scheme control.
 *
 * - This view's `?scheme=light` or `?scheme=dark`, else the choice that the
 *   reader keeps in `localStorage`, sets `data-color-scheme` on the root.
 *   With neither, the root has no attribute, and the page follows the system
 *   scheme through the token CSS.
 * - The control shows only where this script runs, so the island marks the
 *   root for it. As the parser inserts each radio, the island checks the
 *   radio of the scheme in use, before the control first paints.
 * - A choice applies at once and is kept, also a press on the option in
 *   use. The parameter is never kept.
 * - With no kept choice and no parameter, a change of the system scheme
 *   moves the checked radio with the page.
 * - Storage that throws or holds another value keeps no choice.
 *
 * The page head loads this file as a classic, blocking script before any
 * stylesheet: a module or a deferred script would run after the first paint.
 * It is self-contained, so the layout can emit its source and the build can
 * move it into a content-hashed file under /_astro/.
 */
(() => {
  /** Where the reader's choice is kept. */
  const KEY = "mokly.site.scheme";
  /** The name that the control gives both of its radios. */
  const RADIOS = "site-scheme";
  /** The root attribute that the token CSS reads. */
  const SCHEME = "data-color-scheme";
  /** Marks the root where this script runs, so the control shows. */
  const RUNS = "data-scheme-island";
  /** Marks the root for the frame of a scheme flip, which has no transitions. */
  const SWITCHING = "data-scheme-switching";

  const root = document.documentElement;

  /**
   * The scheme that a value names, if it names one.
   * @param {unknown} value
   * @returns {"light" | "dark" | undefined}
   */
  const parse = (value) =>
    value === "light" || value === "dark" ? value : undefined;

  /** The kept choice. Storage that throws keeps none. */
  const kept = () => {
    try {
      return parse(window.localStorage.getItem(KEY));
    } catch {
      return undefined;
    }
  };

  /**
   * Keep a choice. Where storage throws, the choice holds for this view only.
   * @param {"light" | "dark"} scheme
   */
  const keep = (scheme) => {
    try {
      window.localStorage.setItem(KEY, scheme);
    } catch {
      // The choice still applies to this view.
    }
  };

  /** This view's parameter, until the reader chooses in this view. */
  let requested = parse(
    new window.URLSearchParams(window.location.search).get("scheme"),
  );
  /** The scheme on the root, or undefined while the page follows the system. */
  let explicit = requested ?? kept();

  /** @param {"light" | "dark" | undefined} scheme */
  const apply = (scheme) => {
    if (scheme === undefined) root.removeAttribute(SCHEME);
    else root.setAttribute(SCHEME, scheme);
  };

  apply(explicit);

  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const radios = document.getElementsByName(RADIOS);

  /** Check the radio of the scheme in use. */
  const check = () => {
    const scheme = explicit ?? (system.matches ? "dark" : "light");
    for (const radio of radios) {
      if (radio instanceof window.HTMLInputElement)
        radio.checked = radio.value === scheme;
    }
  };

  /**
   * Change the page's scheme with transitions off until the next frame has
   * drawn it, so hover transitions do not animate the whole page.
   * @param {() => void} change
   */
  const flip = (change) => {
    root.setAttribute(SWITCHING, "");
    change();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => root.removeAttribute(SWITCHING));
    });
  };

  // The parser inserts the control after this script has run. Mutation
  // callbacks run before the next frame, so the observer checks each radio
  // as it arrives and the control never draws without its checked radio.
  const observer = new window.MutationObserver(() => {
    check();
    if (radios.length > 1) observer.disconnect();
  });
  observer.observe(root, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", () => observer.disconnect());

  // A choice applies at once and is kept, and it replaces the parameter for
  // the rest of this view. A press on an option fires click, from the
  // pointer and from the arrow keys. It fires on the option in use too,
  // which no change event marks, so that press keeps that option, and the
  // page no longer follows the system scheme.
  document.addEventListener("click", (event) => {
    const radio = event.target;
    if (!(radio instanceof window.HTMLInputElement) || radio.name !== RADIOS)
      return;
    const scheme = parse(radio.value);
    if (scheme === undefined) return;
    requested = undefined;
    explicit = scheme;
    keep(scheme);
    flip(() => apply(scheme));
  });

  // Without a choice the page follows the system scheme, and so does the
  // control.
  system.addEventListener("change", () => {
    if (explicit === undefined) flip(check);
  });

  // A page shown again from the back-forward cache takes a choice made on
  // another page since then. When the reader goes back, the browser can also
  // restore an old checked state into the radios; the check corrects it.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      const scheme = requested ?? kept();
      if (scheme !== explicit) {
        explicit = scheme;
        flip(() => apply(scheme));
      }
    }
    check();
  });

  root.setAttribute(RUNS, "");
})();
