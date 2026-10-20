/**
 * `page.route` emulation of the Changes states that a ready Serve fixture
 * cannot hold on demand: pending, preparing, and unavailable. Each state
 * still reaches the shell through a real publication of the event stream;
 * only the index body that the browser reads is rewritten, the way Serve
 * writes an index before its classification completes.
 */

import type { Page, Route } from "@playwright/test";

import type { ReadyPredicate } from "./serve_comparison_fixture.js";

/** A Changes state that the emulation substitutes for the ready one. */
export type IncompleteStatus = "pending" | "preparing" | "unavailable";

type JsonRecord = Record<string, unknown>;

/** A ready index with every Changes field in one incomplete state. */
export function incompleteIndex(
  index: JsonRecord,
  status: IncompleteStatus,
): JsonRecord {
  const state = { status };
  const entry = (record: JsonRecord): JsonRecord => {
    const next: JsonRecord = { ...record, changes: state };
    delete next["previousPath"];
    if ("comparison" in next) next["comparison"] = state;
    if (Array.isArray(next["views"]))
      next["views"] = (next["views"] as JsonRecord[]).map((view) => ({
        ...view,
        comparison: state,
      }));
    return next;
  };
  const entries = (key: string) =>
    ((index[key] as JsonRecord[] | undefined) ?? []).map(entry);
  return {
    ...index,
    changesStatus: status,
    comparisonUrl: null,
    removedEntries: [],
    screens: entries("screens"),
    components: entries("components"),
    pages: entries("pages"),
    documents: entries("documents"),
    useCases: entries("useCases"),
  };
}

/** Rewrite every index the page reads while an incomplete state is set. */
export async function emulateChangesStatus(page: Page): Promise<{
  set(status: IncompleteStatus | undefined): void;
}> {
  let current: IncompleteStatus | undefined;
  await page.route("**/mokly-viewer/index.json", async (route) => {
    const status = current;
    const response = await route.fetch();
    if (!status) {
      await route.fulfill({ response });
      return;
    }
    await route.fulfill({
      response,
      json: incompleteIndex((await response.json()) as JsonRecord, status),
    });
  });
  return {
    set(status) {
      current = status;
    },
  };
}

/**
 * Hold every incomplete index the page requests, so the shell adopts one
 * ready publication after another, as when Serve combines a rebuild and its
 * classification into one publication. A newer event normally supersedes a
 * held request; `release` answers any that remain with a fresh index.
 */
export async function combinePublications(page: Page): Promise<{
  release(): Promise<void>;
}> {
  const held: Route[] = [];
  await page.route("**/mokly-viewer/index.json", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as JsonRecord;
    if (body["changesStatus"] === "ready") await route.fulfill({ response });
    else held.push(route);
  });
  return {
    async release() {
      for (const route of held.splice(0)) {
        const response = await route.fetch().catch(() => undefined);
        if (response) await route.fulfill({ response }).catch(() => undefined);
      }
    },
  };
}

/** The one source edit each emulated step publishes: the Consumer title. */
export const CONSUMER_SOURCE = "specs/screens/consumer.screen.html";

/** Consumer source text with `title`; the original title is `Consumer screen`. */
export function consumerSource(title: string): string {
  return `---\ntitle: ${title}\n---\n<h1>Consumer screen</h1>\n<ui-card label="Card content"></ui-card>`;
}

/** Accept the publication whose index names the Consumer with `title`. */
export function consumerTitled(title: string): ReadyPredicate {
  return (index) =>
    index.screens.find((entry) => entry.path === "screens/consumer")?.title ===
    title;
}

/**
 * The navigation the reader arranged: filter, search, drawer, tree scroll,
 * disclosure state, and each row's identity, visibility, and position. Row
 * identity, not row text, is compared, so a changed mark may come and go.
 */
export function navigationState(page: Page) {
  return page.evaluate(() => ({
    all: document
      .querySelector('[data-filter="all"]')
      ?.getAttribute("aria-pressed"),
    search: document.querySelector<HTMLInputElement>("[data-mokly-search]")
      ?.value,
    drawer:
      document.querySelector<HTMLElement>("[data-mokly-shell]")?.dataset[
        "drawer"
      ],
    scroll: document.querySelector("[data-mokly-nav-scroll]")?.scrollTop,
    groups: [
      ...document.querySelectorAll<HTMLElement>("[data-nav-disclosure]"),
    ].map((node) => [
      node.dataset["navDisclosure"],
      node instanceof HTMLDetailsElement ? node.open : !node.hidden,
      node.hidden,
    ]),
    rows: [...document.querySelectorAll<HTMLElement>(".mbk-nav-row")].map(
      (node) => ({
        id:
          node.getAttribute("data-route") ??
          node.closest<HTMLElement>("[data-nav-folder]")?.dataset[
            "navFolder"
          ] ??
          node.getAttribute("href"),
        visible: node.checkVisibility(),
        y: node.getBoundingClientRect().y,
      }),
    ),
  }));
}
