/** Catalogue-tree filtering and active-route visibility invariants. */

import { NAV_CHANGED_TEXT_ATTRIBUTE } from "../shell/nav_changed.js";

import {
  isDisclosureOpen,
  isVariantList,
  navDisclosures,
  setDisclosureOpen,
} from "./disclosures.js";
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
      : !row.hasAttribute("data-removed-page") &&
        !row.hasAttribute("data-removed-variant");
    row.hidden =
      waiting || !(matchesFilter && rowMatchesQuery(query, navRowFacts(row)));
    visible ||= !row.hidden;
  }
  applyVariantVisibility(doc);
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
  let ancestor = active.closest<HTMLElement>("[data-nav-disclosure]");
  while (ancestor) {
    const wasOpen = isDisclosureOpen(ancestor);
    setDisclosureOpen(ancestor, true);
    if (
      ancestor.dataset["filterOpen"] !== undefined &&
      (cause === "navigation" || !wasOpen)
    ) {
      ancestor.dataset["filterOpen"] = "1";
    }
    ancestor =
      ancestor.parentElement?.closest<HTMLElement>("[data-nav-disclosure]") ??
      null;
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
    text: navRowText(row),
  };
}

/**
 * A row's searchable label. The changed mark's wording ends every row, so
 * free text matches what the reader sees rather than the mark's `Changed`.
 */
function navRowText(row: Element): string {
  const text = row.textContent ?? "";
  const mark =
    row.querySelector(`[${NAV_CHANGED_TEXT_ATTRIBUTE}]`)?.textContent ?? "";
  return mark === "" ? text : text.slice(0, text.length - mark.length);
}

/**
 * Reconcile every screen row that owns variants with the rows inside its list:
 * the parent stays visible while any of its variants matches the current
 * constraints, and it carries the aggregate mark while any of them is changed.
 * The mark states that the group holds a change, never that the parent screen
 * itself changed.
 */
function applyVariantVisibility(doc: Document): void {
  for (const toggle of doc.querySelectorAll<HTMLElement>(
    "[data-nav-variants-toggle]",
  )) {
    const listId = toggle.getAttribute("aria-controls");
    const list = listId === null ? null : doc.getElementById(listId);
    const leaf = toggle.parentElement;
    const parent = leaf?.querySelector<HTMLElement>("a[data-nav-row]");
    if (!list || !leaf || !parent) continue;
    const rows = [...list.querySelectorAll<HTMLElement>("[data-nav-row]")];
    if (rows.some((row) => !row.hidden)) parent.hidden = false;
    if (rows.some((row) => row.getAttribute("data-changed") === "true"))
      parent.setAttribute("data-changed-variants", "true");
    else parent.removeAttribute("data-changed-variants");
    leaf.hidden = parent.hidden;
  }
}

/**
 * A variant list carries its open state in the same `hidden` attribute that
 * hides a filtered-out group, so filtering opens it exactly while it holds a
 * matching row and restores the remembered state once filtering ends.
 */
function applyGroupVisibility(
  doc: Document,
  filtering: boolean,
  disclosure: NavigationDisclosurePolicy,
): void {
  const groups = navDisclosures(doc);
  if (filtering) {
    for (const group of groups) {
      if (group.dataset["filterOpen"] === undefined) {
        group.dataset["filterOpen"] = isDisclosureOpen(group) ? "1" : "0";
      }
      if (disclosure === "reveal-matches") setDisclosureOpen(group, true);
    }
    for (const group of [...groups].reverse()) {
      const visible = [
        ...group.querySelectorAll<HTMLElement>("[data-nav-row]"),
      ].some((row) => !row.hidden);
      if (isVariantList(group)) setDisclosureOpen(group, visible);
      else group.hidden = !visible;
    }
    return;
  }
  for (const group of groups) {
    const saved = group.dataset["filterOpen"];
    if (saved !== undefined) {
      setDisclosureOpen(group, saved === "1");
      delete group.dataset["filterOpen"];
    }
    if (!isVariantList(group)) group.hidden = false;
  }
}
