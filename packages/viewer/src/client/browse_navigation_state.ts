/** Catalogue-tree filtering and active-route visibility invariants. */

import {
  parseSearchQuery,
  queryConstrains,
  rowMatchesQuery,
} from "./search_query.js";

/** Facts needed to decide which active-row constraints must change. */
export interface NavigationConstraintFacts {
  changed: boolean;
  changedOnly: boolean;
  id?: string;
  query: string;
  route: string;
  tags: readonly string[];
  text: string;
}

/** Minimal control changes needed to reveal one destination row. */
export interface NavigationConstraintChanges {
  clearQuery: boolean;
  showAll: boolean;
}

/** How a visibility update should affect navigation-group disclosure. */
export type NavigationDisclosurePolicy = "preserve" | "reveal-matches";

/** Why the active route's navigation path is being revealed. */
export type NavigationRevealCause = "navigation" | "recovery";

/** Determine which user constraints actually hide a destination. */
export function navigationConstraintChanges(
  facts: NavigationConstraintFacts,
): NavigationConstraintChanges {
  const matchesQuery = rowMatchesQuery(parseSearchQuery(facts.query), facts);
  return {
    clearQuery: !matchesQuery,
    showAll: facts.changedOnly && !facts.changed,
  };
}

/** Apply the current navigation controls with an explicit disclosure policy. */
export function applyNavVisibility(
  doc: Document,
  disclosure: NavigationDisclosurePolicy,
): void {
  const query = parseSearchQuery(
    doc.querySelector<HTMLInputElement>("[data-mokly-search]")?.value ?? "",
  );
  const changedOnly =
    doc
      .querySelector('[data-filter="changed"]')
      ?.getAttribute("aria-pressed") === "true";
  const status = doc.querySelector<HTMLElement>("[data-changes-status]")
    ?.dataset["changesStatus"];
  const waiting = changedOnly && status !== undefined && status !== "ready";
  let visible = false;
  for (const row of doc.querySelectorAll<HTMLElement>("[data-nav-row]")) {
    const matchesFilter = changedOnly
      ? row.getAttribute("data-changed") === "true"
      : !row.hasAttribute("data-removed-page");
    row.hidden =
      waiting || !(matchesFilter && rowMatchesQuery(query, navRowFacts(row)));
    visible ||= !row.hidden;
  }
  const notice = doc.querySelector<HTMLElement>("[data-nav-status]");
  if (notice) {
    notice.hidden = !changedOnly || (!waiting && visible);
    const text = notice.querySelector("[data-nav-status-text]");
    if (text && status === "ready")
      text.textContent = queryConstrains(query)
        ? "No matching changes."
        : "No changes found.";
  }
  doc
    .querySelector("[data-mokly-nav-scroll]")
    ?.setAttribute(
      "aria-busy",
      String(waiting && (status === "pending" || status === "preparing")),
    );
  applyGroupVisibility(doc, queryConstrains(query) || changedOnly, disclosure);
}

/** Select one route and disclose, reveal, and scroll its catalogue row. */
export function selectAndRevealRoute(
  doc: Document,
  pathname: string,
  baseHref: string,
  cause: NavigationRevealCause,
): HTMLAnchorElement | undefined {
  const rows = [...doc.querySelectorAll<HTMLAnchorElement>("a[data-nav-row]")];
  let active: HTMLAnchorElement | undefined;
  for (const row of rows) {
    const matches =
      active === undefined &&
      new URL(row.getAttribute("href") ?? "", baseHref).pathname === pathname;
    if (matches) {
      active = row;
      row.setAttribute("aria-current", "page");
    } else {
      row.removeAttribute("aria-current");
    }
  }
  if (!active) return undefined;
  const search = doc.querySelector<HTMLInputElement>("[data-mokly-search]");
  const changedOnly =
    doc
      .querySelector('[data-filter="changed"]')
      ?.getAttribute("aria-pressed") === "true";
  const changes = navigationConstraintChanges({
    changed: active.getAttribute("data-changed") === "true",
    changedOnly,
    query: search?.value ?? "",
    ...navRowFacts(active),
  });
  if (changes.clearQuery && search) search.value = "";
  if (changes.showAll) {
    for (const option of doc.querySelectorAll<HTMLElement>("[data-filter]")) {
      option.setAttribute(
        "aria-pressed",
        option.getAttribute("data-filter") === "all" ? "true" : "false",
      );
    }
  }
  applyNavVisibility(doc, "preserve");
  let ancestor = active.closest<HTMLDetailsElement>(
    "details[data-nav-disclosure]",
  );
  while (ancestor) {
    const wasOpen = ancestor.open;
    ancestor.open = true;
    if (
      ancestor.dataset["filterOpen"] !== undefined &&
      (cause === "navigation" || !wasOpen)
    ) {
      ancestor.dataset["filterOpen"] = "1";
    }
    ancestor =
      ancestor.parentElement?.closest<HTMLDetailsElement>(
        "details[data-nav-disclosure]",
      ) ?? null;
  }
  active.scrollIntoView({ block: "nearest" });
  return active;
}

function navRowFacts(row: Element): {
  id?: string;
  route: string;
  tags: readonly string[];
  text: string;
} {
  const id = row.getAttribute("data-entry-id");
  return {
    ...(id === null ? {} : { id }),
    route: row.getAttribute("data-route") ?? "",
    tags: (row.getAttribute("data-tags") ?? "")
      .split(/\s+/)
      .filter((tag) => tag !== ""),
    text: row.textContent ?? "",
  };
}

function applyGroupVisibility(
  doc: Document,
  filtering: boolean,
  disclosure: NavigationDisclosurePolicy,
): void {
  const groups = [
    ...doc.querySelectorAll<HTMLDetailsElement>("details[data-nav-disclosure]"),
  ];
  if (filtering) {
    for (const group of groups) {
      if (group.dataset["filterOpen"] === undefined) {
        group.dataset["filterOpen"] = group.open ? "1" : "0";
      }
      if (disclosure === "reveal-matches") group.open = true;
    }
    for (const group of [...groups].reverse()) {
      const visible = [
        ...group.querySelectorAll<HTMLElement>("[data-nav-row]"),
      ].some((row) => !row.hidden);
      group.hidden = !visible;
    }
    return;
  }
  for (const group of groups) {
    const saved = group.dataset["filterOpen"];
    if (saved !== undefined) {
      group.open = saved === "1";
      delete group.dataset["filterOpen"];
    }
    group.hidden = false;
  }
}
