/**
 * Documentation search. The island renders the search dialog once on every
 * docs page and binds the search controls that the page draws in the Layers
 * panel and in the sub-bar, each of which names the dialog in
 * `aria-controls`. ⌘K or Ctrl K, and `/` outside a text field, open it too,
 * and on Apple platforms the controls' key hint reads ⌘K. Close, Escape and
 * a press on the dimmed page close it. A press inside it, also on its
 * padding, keeps it open. The dialog queries the index the build wrote
 * beside the pages, and every result links to the page and, when the match
 * is inside a section, to that heading. The index is loaded on the first
 * search, so a reader who never searches downloads nothing.
 */

import { useEffect, useRef, useState } from "react";

import { CanvasIcon } from "./CanvasIcon.js";
import { keyHint, opensSearch } from "./search-keys.js";

interface SubResult {
  readonly title: string;
  readonly url: string;
}

interface ResultData {
  readonly meta?: { readonly title?: string };
  readonly sub_results?: readonly SubResult[];
  readonly url: string;
}

interface SearchIndex {
  init(): Promise<void>;
  search(query: string): Promise<{
    readonly results: readonly { data(): Promise<ResultData> }[];
  }>;
}

/** The id of the dialog, which each search control names in `aria-controls`. */
const DIALOG = "site-search";

const RESULTS = 6;

let index: Promise<SearchIndex> | undefined;

/** Whether a press on a modal dialog fell outside its box, on the backdrop. */
function onBackdrop(dialog: HTMLDialogElement, event: MouseEvent): boolean {
  if (event.target !== dialog) return false;
  const box = dialog.getBoundingClientRect();
  return (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  );
}

/**
 * Close the dialog on a press on the dimmed page where the browser does not
 * implement `closedby="any"`. A press on the backdrop targets the dialog
 * itself, as a press on the dialog's own box does, so only a press outside
 * the box counts. As with `closedby`, a press that starts inside the dialog
 * and ends on the dimmed page, such as a text selection in the field, keeps
 * it open. Answers the function that removes the listeners.
 */
function closeOnBackdrop(dialog: HTMLDialogElement): () => void {
  let pressed = false;
  const onPointerDown = (event: PointerEvent) => {
    pressed = onBackdrop(dialog, event);
  };
  const onClick = (event: MouseEvent) => {
    if (pressed && onBackdrop(dialog, event)) dialog.close();
    pressed = false;
  };
  dialog.addEventListener("pointerdown", onPointerDown);
  dialog.addEventListener("click", onClick);
  return () => {
    dialog.removeEventListener("pointerdown", onPointerDown);
    dialog.removeEventListener("click", onClick);
  };
}

async function load(): Promise<SearchIndex> {
  index ??= (async () => {
    const module = (await import(
      /* @vite-ignore */ `${window.location.origin}/pagefind/pagefind.js`
    )) as SearchIndex;
    await module.init();
    return module;
  })();
  return index;
}

/** The search dialog, its controls and its keys. */
export default function Search() {
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly ResultData[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const open = () => {
      if (!element.open) element.showModal();
      field.current?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (!opensSearch(event)) return;
      event.preventDefault();
      open();
    };
    const controls = [
      ...document.querySelectorAll<HTMLButtonElement>(
        `button[aria-controls="${DIALOG}"]`,
      ),
    ];
    const hint = keyHint(navigator.userAgent);
    for (const control of controls) {
      control.addEventListener("click", open);
      const key = control.querySelector("kbd");
      if (key) key.textContent = hint;
    }
    document.addEventListener("keydown", onKey);
    const stopBackdrop =
      "closedBy" in HTMLDialogElement.prototype
        ? undefined
        : closeOnBackdrop(element);
    return () => {
      for (const control of controls) {
        control.removeEventListener("click", open);
      }
      document.removeEventListener("keydown", onKey);
      stopBackdrop?.();
    };
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length === 0) {
      setResults([]);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const found = await (await load()).search(term);
          const data = await Promise.all(
            found.results.slice(0, RESULTS).map((result) => result.data()),
          );
          if (active) {
            setResults(data);
            setFailed(false);
          }
        } catch {
          if (active) {
            setResults([]);
            setFailed(true);
          }
        }
      })();
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <dialog
      aria-label="Search the documentation"
      className="site-search-dialog"
      closedby="any"
      id={DIALOG}
      ref={dialog}
    >
      <div className="site-search-field">
        <label className="site-visually-hidden" htmlFor="site-search-input">
          Search the documentation
        </label>
        <span className="site-search-box">
          <CanvasIcon name="search" size={17} />
          <input
            autoComplete="off"
            className="site-search-input"
            id="site-search-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the documentation"
            ref={field}
            type="search"
            value={query}
          />
        </span>
        <button
          className="site-search-close"
          onClick={() => dialog.current?.close()}
          type="button"
        >
          <CanvasIcon name="close" size={16} />
          Close
        </button>
      </div>
      <Results failed={failed} query={query} results={results} />
    </dialog>
  );
}

function Results({
  failed,
  query,
  results,
}: {
  readonly failed: boolean;
  readonly query: string;
  readonly results: readonly ResultData[];
}) {
  if (failed) {
    return <p className="site-search-empty">Search is unavailable here.</p>;
  }
  if (query.trim().length === 0) {
    return (
      <p className="site-search-empty">
        Type to search every page of the docs.
      </p>
    );
  }
  if (results.length === 0) {
    return <p className="site-search-empty">Nothing matched that search.</p>;
  }
  return (
    <ul className="site-search-results">
      {results.map((result) => (
        <li key={result.url}>
          <a className="site-search-result" href={result.url}>
            {result.meta?.title ?? result.url}
          </a>
          {(result.sub_results ?? [])
            .filter((sub) => sub.url.includes("#"))
            .slice(0, 2)
            .map((sub) => (
              <a
                className="site-search-result site-search-result-heading"
                href={sub.url}
                key={sub.url}
              >
                {sub.title}
              </a>
            ))}
        </li>
      ))}
    </ul>
  );
}
