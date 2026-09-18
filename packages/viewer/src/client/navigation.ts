/** Shell-link eligibility and latest-wins progressive navigation sequencing. */

/** Anchor facts used to decide whether Browse may intercept a click. */
export interface BrowseLinkCandidate {
  download: boolean;
  modified: boolean;
  pathname: string;
  sameOrigin: boolean;
  samePageHash: boolean;
  target: string;
}

/** Decide whether one clicked link is an eligible in-shell navigation. */
export function isEligibleBrowseLink(candidate: BrowseLinkCandidate): boolean {
  if (!candidate.sameOrigin) return false;
  if (candidate.download || candidate.modified || candidate.samePageHash) {
    return false;
  }
  if (candidate.target !== "" && candidate.target !== "_self") return false;
  return (
    candidate.pathname === "/" ||
    candidate.pathname.startsWith("/view/") ||
    candidate.pathname.startsWith("/id/")
  );
}

/** Fragment navigation stays within one document; route or query changes do not. */
export function isSameBrowseDocument(current: URL, next: URL): boolean {
  return (
    current.origin === next.origin &&
    current.pathname === next.pathname &&
    current.search === next.search
  );
}

/** Latest-wins request sequencing for overlapping navigations. */
export class NavigationSequencer {
  #current: AbortController | undefined;

  /** Abort the previous request and open a new latest-wins slot. */
  begin(): { isCurrent(): boolean; signal: AbortSignal } {
    this.cancel();
    const controller = new AbortController();
    this.#current = controller;
    return {
      isCurrent: () => this.#current === controller,
      signal: controller.signal,
    };
  }

  /** Invalidate outstanding work when history retains the current document. */
  cancel(): void {
    this.#current?.abort();
    this.#current = undefined;
  }
}
