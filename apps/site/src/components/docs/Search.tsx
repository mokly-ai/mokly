/**
 * Documentation search. The header control opens a dialog that queries the
 * index the build wrote beside the pages, and every result links to the page
 * and, when the match is inside a section, to that heading. The index is
 * loaded on the first search, so a reader who never searches downloads
 * nothing.
 */

import { useEffect, useRef, useState } from "react";

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

const RESULTS = 6;

let index: Promise<SearchIndex> | undefined;

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

/** The header search control and the dialog it opens. */
export default function Search() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly ResultData[]>([]);
  const [failed, setFailed] = useState(false);

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
    <>
      <button
        className="site-search"
        onClick={() => dialog.current?.showModal()}
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="14"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="14"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.9-3.9" />
        </svg>
        Search docs
      </button>
      <dialog
        aria-label="Search the documentation"
        className="site-search-dialog"
        ref={dialog}
      >
        <div className="site-search-field">
          <label className="site-visually-hidden" htmlFor="site-search-input">
            Search the documentation
          </label>
          <input
            autoComplete="off"
            className="site-search-input"
            id="site-search-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the documentation"
            type="search"
            value={query}
          />
          <button
            className="site-code-copy"
            onClick={() => dialog.current?.close()}
            type="button"
          >
            Close
          </button>
        </div>
        <Results failed={failed} query={query} results={results} />
      </dialog>
    </>
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
