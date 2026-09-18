/** Durable disclosure preferences for Browse navigation groups. */

/** Storage subset used by navigation disclosure preferences. */
export interface NavPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const NAV_DISCLOSURE_KEY = "mokly:nav-disclosure:v2";

/** Whether a value identifies a current or legacy navigation disclosure. */
export function isNavDisclosureKey(value: string): boolean {
  return (
    value.startsWith("collection:") ||
    value === "section:pages" ||
    value === "section:components"
  );
}

/** Match a current disclosure key, including an old unsectioned collection key. */
export function isNavDisclosureClosed(
  closed: ReadonlySet<string>,
  key: string,
): boolean {
  if (closed.has(key)) return true;
  for (const prefix of ["collection:pages:", "collection:components:"]) {
    if (key.startsWith(prefix)) {
      return closed.has(`collection:${key.slice(prefix.length)}`);
    }
  }
  return false;
}

/** Remember closed groups by stable collection id. */
export class NavDisclosurePreference {
  readonly #storage: NavPreferenceStorage | undefined;
  #closed: ReadonlySet<string> | undefined;

  constructor(storage: NavPreferenceStorage | undefined = undefined) {
    this.#storage = storage;
    this.#closed = this.read();
  }

  /** Apply an explicit stored preference without replacing server defaults. */
  apply(doc: Document): void {
    if (!this.#closed) return;
    for (const group of navigationGroups(doc)) {
      const key = group.getAttribute("data-nav-disclosure");
      if (key && isNavDisclosureKey(key))
        group.open = !isNavDisclosureClosed(this.#closed, key);
    }
  }

  /** Capture and persist the current closed-group set. */
  remember(doc: Document): void {
    const closed = navigationGroups(doc).flatMap((group) => {
      const key = group.getAttribute("data-nav-disclosure");
      return !group.open && key && isNavDisclosureKey(key) ? [key] : [];
    });
    this.#closed = new Set(closed);
    try {
      this.#storage?.setItem(NAV_DISCLOSURE_KEY, JSON.stringify(closed));
    } catch {
      // In-memory state still preserves the choice for this document.
    }
  }

  private read(): ReadonlySet<string> | undefined {
    try {
      const value = this.#storage?.getItem(NAV_DISCLOSURE_KEY);
      if (value === null || value === undefined) return undefined;
      const parsed: unknown = JSON.parse(value);
      if (
        !Array.isArray(parsed) ||
        !parsed.every((item) => typeof item === "string")
      ) {
        return undefined;
      }
      return new Set(parsed.filter(isNavDisclosureKey));
    } catch {
      return undefined;
    }
  }
}

/** Create a preference without failing when browser storage is unavailable. */
export function createBrowserNavPreference(
  win: Window & typeof globalThis,
): NavDisclosurePreference {
  try {
    return new NavDisclosurePreference(win.localStorage);
  } catch {
    return new NavDisclosurePreference();
  }
}

function navigationGroups(doc: Document): HTMLDetailsElement[] {
  return [
    ...doc.querySelectorAll<HTMLDetailsElement>("details[data-nav-disclosure]"),
  ];
}
