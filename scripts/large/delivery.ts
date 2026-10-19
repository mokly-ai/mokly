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
  } = {},
) {
  await page.waitForFunction(
    ({ afterRevision = 0, previousGeneration, ready = true }) => {
      const state = window.moklyBenchmark;
      const value = state?.index?.value;
      if (!value || typeof value !== "object" || !("revision" in value))
        return false;
      if (typeof value.revision !== "number" || value.revision <= afterRevision)
        return false;
      if (!("deploymentId" in value)) return false;
      if (
        !state.events.some(
          (event) =>
            event.revision === value.revision &&
            event.deploymentId === value.deploymentId,
        )
      )
        return false;
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
      return (
        !ready ||
        ("changesStatus" in value &&
          (value.changesStatus === "ready" ||
            value.changesStatus === "unavailable"))
      );
    },
    options,
    { timeout: 60_000 },
  );
  const observed = await page.evaluate(() => window.moklyBenchmark);
  if (observed.errors.length) throw new Error(observed.errors.join("\n"));
  const index = readCatalogueIndex(observed.index?.value);
  if (options.ready !== false && index.changesStatus !== "ready")
    throw new Error(`Delivered Changes is ${index.changesStatus}`);
  const publication = observed.events.find(
    (event) =>
      event.revision === index.revision &&
      event.deploymentId === index.deploymentId,
  );
  if (!publication || !observed.index)
    throw new Error("Missing delivered publication");
  return { index, publication, indexReceivedMs: observed.index.receivedMs };
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
