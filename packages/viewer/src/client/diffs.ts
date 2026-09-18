/** Lazy comparison requests, with cancellation when a user leaves the screen. */

import { parseReviewResult } from "../review/result_validation.js";

import { renderDiff, type DiffMode, type LoadedDiff } from "./diff_views.js";
import { readStaticDelivery } from "./static_delivery.js";

/** Install one delegated controller on the persistent catalogue document. */
export function installDiffs(
  doc: Document,
  win: Window & typeof globalThis,
  onError?: (error: unknown) => void,
): { reset(): void; update(): void } {
  let request: AbortController | undefined;
  let loaded: LoadedDiff | undefined;
  let loadedSelection: string | undefined;
  let requestedSelection: string | undefined;
  let screen: HTMLElement | undefined;
  let mode: DiffMode = "current";

  const reset = (): void => {
    request?.abort();
    request = undefined;
    loaded = undefined;
    loadedSelection = undefined;
    requestedSelection = undefined;
    screen = undefined;
    mode = "current";
  };
  const display = (): void => {
    if (!screen?.isConnected) return;
    const stage = screen.querySelector<HTMLElement>("[data-diff-stage]");
    const current = screen.querySelector<HTMLElement>("[data-current-screen]");
    const refresh = screen.querySelector<HTMLElement>("[data-diff-refresh]");
    if (!stage || !current) return;
    current.hidden = mode !== "current";
    stage.hidden = mode === "current";
    if (refresh) refresh.hidden = mode === "current" || loaded === undefined;
    for (const button of screen.querySelectorAll("[data-diff-mode]")) {
      button.setAttribute(
        "aria-pressed",
        String(button.getAttribute("data-diff-mode") === mode),
      );
    }
    if (mode === "current") {
      stage.replaceChildren();
    } else if (loaded) {
      renderDiff(
        doc,
        stage,
        loaded,
        screen.dataset["diffScreen"] ?? "",
        mode,
        screen.dataset["diffVariant"],
      );
    }
    doc.dispatchEvent(
      new win.CustomEvent<LoadedDiff | undefined>("mokly:comparison", {
        detail: loadedSelection === selectionKey(screen) ? loaded : undefined,
      }),
    );
  };
  doc.addEventListener("mokly:evidence-updated", () => {
    request?.abort();
    request = undefined;
    loaded = undefined;
    loadedSelection = undefined;
    requestedSelection = undefined;
    if (mode !== "current") {
      mode = "current";
      display();
    }
  });
  const load = async (refresh: boolean, cached?: LoadedDiff): Promise<void> => {
    const target = screen;
    const stage = target?.querySelector<HTMLElement>("[data-diff-stage]");
    if (!target || !stage) return;
    request?.abort();
    const pending = new win.AbortController();
    request = pending;
    const selection = selectionKey(target);
    requestedSelection = selection;
    loaded = undefined;
    display();
    stage.setAttribute("aria-busy", "true");
    if (!cached) stage.textContent = "Loading comparison…";
    try {
      const delivery = readStaticDelivery(doc);
      if (delivery?.comparisonUrl === null)
        throw new Error("Comparisons are unavailable in this catalogue.");
      let comparison = cached;
      if (comparison && !delivery) {
        const renewal = await win.fetch(comparison.url, {
          method: "HEAD",
          cache: "no-store",
          signal: pending.signal,
        });
        if (!renewal.ok || renewal.url !== comparison.url)
          comparison = undefined;
      }
      if (!comparison) {
        stage.textContent = "Loading comparison…";
        const endpoint = new URL(
          delivery?.comparisonUrl ?? "/__mokly/diffs/review.json",
          win.location.href,
        );
        if (!delivery) {
          endpoint.searchParams.set(
            "route",
            target.dataset["diffScreen"] ?? "",
          );
          const variant = target.dataset["diffVariant"];
          if (variant) endpoint.searchParams.set("variant", variant);
        }
        if (refresh) endpoint.searchParams.set("refresh", "1");
        const response = await win.fetch(endpoint.href, {
          signal: pending.signal,
          headers: { accept: "application/json" },
        });
        if (!response.ok) {
          const failure = (await response.json()) as { details?: unknown };
          throw new Error(
            typeof failure.details === "string"
              ? failure.details
              : "Comparison unavailable",
          );
        }
        const payload: unknown = await response.json();
        comparison = {
          result: parseReviewResult(payload),
          url: response.url,
        };
      }
      if (
        pending.signal.aborted ||
        !target.isConnected ||
        screen !== target ||
        selection !== selectionKey(target) ||
        mode === "current"
      )
        return;
      loaded = comparison;
      loadedSelection = selection;
      display();
    } catch (error) {
      if (
        pending.signal.aborted ||
        !target.isConnected ||
        screen !== target ||
        selection !== selectionKey(target) ||
        mode === "current"
      )
        return;
      stage.textContent = "The comparison could not be loaded. ";
      const retry = doc.createElement("button");
      retry.type = "button";
      retry.setAttribute("data-diff-refresh", "");
      retry.textContent = "Try again";
      stage.append(retry);
      if (error instanceof Error && !onError) {
        const details = doc.createElement("details");
        const summary = doc.createElement("summary");
        summary.textContent = "Comparison details";
        const description = doc.createElement("p");
        description.textContent = error.message;
        details.append(summary, description);
        details.setAttribute("data-comparison-failure", "");
        doc.querySelector("[data-comparison-failure]")?.remove();
        doc.querySelector('[data-inspector-panel="details"]')?.append(details);
      }
      onError?.(error);
    } finally {
      if (request === pending) {
        request = undefined;
        stage.removeAttribute("aria-busy");
      }
    }
  };
  const update = (refresh = false): void => {
    if (mode === "current") {
      display();
      return;
    }
    const selection = screen ? selectionKey(screen) : undefined;
    if (request && selection === requestedSelection && !refresh) {
      display();
      return;
    }
    const cached =
      !refresh && selection === loadedSelection ? loaded : undefined;
    void load(refresh, cached);
  };
  doc.addEventListener("click", (event) => {
    const target =
      event.target instanceof win.Element ? event.target : undefined;
    if (!target) return;
    const option = target.closest<HTMLElement>("[data-diff-mode]");
    const refresh = target.closest("[data-diff-refresh]");
    if (option || refresh) {
      const owning = target.closest<HTMLElement>("[data-diff-screen]");
      if (!owning) return;
      if (screen !== owning) {
        reset();
        screen = owning;
      }
      const selected = option?.dataset["diffMode"];
      if (mode === "current" && selected !== "current") loaded = undefined;
      if (
        selected === "current" ||
        selected === "side" ||
        selected === "overlay" ||
        selected === "difference"
      )
        mode = selected;
      if (mode === "current") {
        request?.abort();
        request = undefined;
      }
      update(Boolean(refresh));
      return;
    }
  });
  return { reset, update };
}

function selectionKey(screen: HTMLElement): string {
  return JSON.stringify([
    screen.dataset["diffScreen"],
    screen.dataset["diffVariant"],
  ]);
}
