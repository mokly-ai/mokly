/** Observe the shell's own event stream and index responses in the browser. */
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { readCatalogueIndex } from "../../packages/viewer/src/catalogue/index_reader.js";
import type { CatalogueReadModel } from "../../packages/viewer/src/catalogue/types.js";

export type Publication = Pick<
  CatalogueReadModel,
  "deploymentId" | "revision"
> & {
  receivedMs: number;
};
interface Observations {
  events: Publication[];
  index?: { value: unknown; receivedMs: number };
  errors: string[];
}
declare global {
  interface Window {
    moklyBenchmark: Observations;
  }
}

export async function observeDelivery(page: Page) {
  await page.addInitScript(() => {
    if (window !== window.top) return;
    const observations: Observations = { events: [], errors: [] };
    window.moklyBenchmark = observations;
    const NativeEventSource = window.EventSource;
    window.EventSource = class extends NativeEventSource {
      constructor(url: string | URL, settings?: EventSourceInit) {
        super(url, settings);
        if (new URL(url, location.href).pathname !== "/mokly-viewer/events")
          return;
        this.addEventListener("message", (event) => {
          observations.events.push({
            deploymentId: String(event.data),
            revision: Number(event.lastEventId),
            receivedMs: performance.now(),
          });
        });
      }
    };
    const request = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await request(...args);
      if (new URL(response.url).pathname === "/mokly-viewer/index.json") {
        void response
          .clone()
          .json()
          .then((value: unknown) => {
            observations.index = { value, receivedMs: performance.now() };
          })
          .catch((error: unknown) => {
            if (!(error instanceof DOMException && error.name === "AbortError"))
              observations.errors.push(String(error));
          });
      }
      return response;
    };
  });
}

/** Require a delivered index and its stream identity, not a terminal span. */
export async function delivered(
  page: Page,
  options: {
    afterRevision?: number;
    previousGeneration?: string;
    ready?: boolean;
    timeoutMs?: number;
  } = {},
) {
  const handle = await page.waitForFunction(
    ({ afterRevision = 0, previousGeneration, ready = true }) => {
      const state = window.moklyBenchmark;
      if (!state?.index) return false;
      if (state.errors.length) throw new Error(state.errors.join("\n"));
      const value = state.index.value;
      if (!value || typeof value !== "object" || !("revision" in value))
        return false;
      if (typeof value.revision !== "number" || value.revision <= afterRevision)
        return false;
      if (!("deploymentId" in value)) return false;
      const publication = state.events.find(
        (event) =>
          event.revision === value.revision &&
          event.deploymentId === value.deploymentId,
      );
      if (!publication) return false;
      if (previousGeneration !== undefined) {
        if (
          !("live" in value) ||
          !value.live ||
          typeof value.live !== "object" ||
          !("generation" in value.live) ||
          value.live.generation === previousGeneration
        )
          return false;
      }
      if (
        ready &&
        !(
          "changesStatus" in value &&
          (value.changesStatus === "ready" ||
            value.changesStatus === "unavailable")
        )
      )
        return false;
      return { value, publication, indexReceivedMs: state.index.receivedMs };
    },
    options,
    { timeout: options.timeoutMs ?? 60_000 },
  );
  const observed = await handle.jsonValue();
  await handle.dispose();
  if (!observed) throw new Error("Missing delivered publication");
  const index = readCatalogueIndex(observed.value);
  if (options.ready !== false && index.changesStatus !== "ready")
    throw new Error(`Delivered Changes is ${index.changesStatus}`);
  return {
    index,
    publication: observed.publication,
    indexReceivedMs: observed.indexReceivedMs,
  };
}

export function changedEntries(index: CatalogueReadModel) {
  return [
    ...index.screens,
    ...index.components,
    ...index.pages,
    ...index.documents,
    ...index.useCases,
    ...index.removedEntries.map((removed) => removed.entry),
  ].filter(
    (entry) => entry.changes.status === "ready" && entry.changes.included,
  );
}

export async function changesVisible(page: Page, index: CatalogueReadModel) {
  await expect(page.locator("[data-mokly-filter]")).toHaveAttribute(
    "data-changes-status",
    "ready",
    { timeout: 60_000 },
  );
  await expect(
    page.locator("[data-filter=changed] .mbk-nav-filter-count"),
  ).toHaveText(String(changedEntries(index).length), { timeout: 60_000 });
}
