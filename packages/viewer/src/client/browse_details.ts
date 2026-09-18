/** Durable disclosure preference for the Browse details inspector. */

/** Storage subset used by the details disclosure preference. */
export interface DetailsPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const DETAILS_DISCLOSURE_KEY = "mokly:details-disclosure";

/** Remember and apply the user's latest details disclosure choice. */
export class DetailsDisclosurePreference {
  readonly #storage: DetailsPreferenceStorage | undefined;
  #open: boolean | undefined;

  constructor(storage: DetailsPreferenceStorage | undefined = undefined) {
    this.#storage = storage;
    this.#open = this.read();
  }

  /** The last explicit choice, shared by the icon inspector and legacy details. */
  get preferredOpen(): boolean | undefined {
    return this.#open;
  }

  /** Apply an explicit preference to the current route's details panel. */
  apply(doc: Document): void {
    const details = doc.querySelector<HTMLDetailsElement>(
      "[data-mokly-details]",
    );
    if (details && this.#open !== undefined) details.open = this.#open;
  }

  /** Record a user disclosure change for later routes and page loads. */
  remember(open: boolean): void {
    this.#open = open;
    try {
      this.#storage?.setItem(DETAILS_DISCLOSURE_KEY, open ? "open" : "closed");
    } catch {
      // In-memory state still preserves the choice for this document.
    }
  }

  /** Record the state produced by a summary activation before a later task. */
  rememberActivation(details: HTMLDetailsElement): void {
    const openBeforeActivation = details.open;
    queueMicrotask(() => {
      if (details.open !== openBeforeActivation) this.remember(details.open);
    });
  }

  private read(): boolean | undefined {
    try {
      const value = this.#storage?.getItem(DETAILS_DISCLOSURE_KEY);
      if (value === "open") return true;
      if (value === "closed") return false;
    } catch {
      // An unavailable browser store leaves the server-rendered default intact.
    }
    return undefined;
  }
}

/** Create a preference without failing when browser storage is unavailable. */
export function createBrowserDetailsPreference(
  win: Window & typeof globalThis,
): DetailsDisclosurePreference {
  try {
    return new DetailsDisclosurePreference(win.localStorage);
  } catch {
    return new DetailsDisclosurePreference();
  }
}
