import type { CatalogueReadModel } from "../catalogue/types.js";
import { installDiffs } from "../client/diffs.js";
import type { FrameAdapter } from "../client/frame_adapter.js";
import { initializeNavigationResize } from "../client/nav_resize.js";
import { handleTagPickerKeydown } from "../client/tag_filter.js";
import { installWorkspace } from "../client/workspace.js";

import { runCleanup } from "./cleanup.js";
import { viewerFailures } from "./failures.js";
import { ViewerFrames } from "./frames.js";
import { identifierScope } from "./identifiers.js";
import { viewerInput } from "./input.js";
import { viewerCatalogue } from "./projection.js";
import { routeMarkup } from "./route_markup.js";
import { ViewerRouting } from "./routing.js";
import { runtimeScope } from "./scope.js";
import {
  mergeSelection,
  normalizeSelection,
  routedEntries,
  sameSelection,
} from "./selection.js";
import { syncSelection } from "./selection_dom.js";
import { slotLayout } from "./slot_layout.js";
import type {
  MoklyViewerHandle,
  ViewerEvents,
  ViewerSelection,
} from "./types.js";

/** One source/adapter generation; React never reconciles its route islands. */
export class ViewerRuntime implements MoklyViewerHandle {
  private error: ReturnType<typeof viewerFailures>;
  private identify: () => void;
  private slots: ReturnType<typeof slotLayout>;
  private scope: ReturnType<typeof runtimeScope>;
  private frames: ViewerFrames;
  private catalogue: ReturnType<typeof viewerCatalogue>;
  private diffs: ReturnType<typeof installDiffs>;
  private stopResize: () => void;
  private workspace: ReturnType<typeof installWorkspace> = {
    dispose: () => {},
    setVariant: () => {},
  };
  private disposed = false;
  private route: ViewerRouting;
  private selection: ViewerSelection;
  constructor(
    private root: HTMLElement,
    private model: CatalogueReadModel,
    private baseUrl: URL,
    adapter: FrameAdapter,
    selection: ViewerSelection,
    private controlled: boolean,
    private events: () => ViewerEvents,
  ) {
    this.error = viewerFailures(events, () => !this.disposed);
    this.selection = normalizeSelection(model, selection);
    this.catalogue = viewerCatalogue(model);
    this.scope = runtimeScope(root, baseUrl, model.comparisonUrl);
    this.route = new ViewerRouting(model, baseUrl, {
      selection: () => this.selection,
      select: (value) => this.select(value),
      refresh: () => this.apply(true),
      endPick: () => this.frames.end({ reason: "navigation" }),
      open: (url, target, features) =>
        this.scope.win.open(url, target, features),
      events,
    });
    this.identify = identifierScope(root);
    this.slots = slotLayout(root, () => this.selection.screenId === null);
    this.frames = new ViewerFrames(
      root,
      model,
      baseUrl,
      adapter,
      events,
      (navigation) => this.route.frame(navigation),
      this.selection,
      (error) => this.error(error, "frame"),
    );
    this.diffs = installDiffs(this.scope.doc, this.scope.win, (error) => {
      this.frames.end({ reason: "error" });
      this.error(error, "comparison");
    });
    const { doc, win } = this.scope;
    const act = (event: Event) =>
      viewerInput(event, {
        doc,
        model,
        baseUrl,
        selection: () => this.selection,
        select: (value) => this.select(value),
        navigate: (id, url) => this.route.shell(id, url),
        refresh: () => this.apply(false),
        updateDiffs: this.diffs.update,
      });
    for (const name of ["click", "input", "change"])
      doc.addEventListener(name, act, true);
    doc.addEventListener(
      "keydown",
      (event) => {
        if (
          handleTagPickerKeydown(
            doc,
            event.key,
            event.target instanceof Element ? event.target : undefined,
          )
        )
          event.preventDefault();
        else if (event.key === "Escape") this.frames.end({ reason: "escape" });
      },
      true,
    );
    doc.addEventListener("mokly:comparison", () => {
      if (
        doc
          .querySelector('[data-diff-mode][aria-pressed="true"]')
          ?.getAttribute("data-diff-mode") !== "current"
      )
        this.frames.end({ reason: "navigation" });
    });
    this.stopResize = initializeNavigationResize(doc, win);
    this.apply(true);
  }
  select(partial: Partial<ViewerSelection>): void {
    if (this.disposed) return;
    let next: ViewerSelection;
    try {
      next = mergeSelection(this.model, this.selection, partial);
    } catch (error) {
      throw this.error(error, "selection");
    }
    if (sameSelection(this.selection, next)) return;
    if (!this.controlled) this.commit(next);
    this.events().onSelectionChange?.(next);
  }
  commit(next: ViewerSelection): void {
    if (this.disposed) return;
    const previous = this.selection;
    try {
      next = normalizeSelection(this.model, next);
    } catch (error) {
      throw this.error(error, "selection");
    }
    if (sameSelection(previous, next)) return;
    const routeChanged = previous.screenId !== next.screenId;
    const variantChanged = previous.variantId !== next.variantId;
    this.selection = next;
    if (routeChanged || variantChanged) {
      this.frames.end({ reason: "navigation" });
      this.route.commit(next, routeChanged);
    }
    this.apply(routeChanged, variantChanged);
    if (routeChanged || variantChanged) this.route.announce();
  }
  private apply(routeChanged: boolean, variantChanged = false): void {
    const { doc, win } = this.scope;
    if (routeChanged) {
      this.workspace.dispose();
      this.diffs.reset();
      const main = doc.querySelector<HTMLElement>("[data-mokly-view]")!;
      const next = routeMarkup(
        this.model,
        this.catalogue,
        this.selection,
        this.baseUrl,
        this.route.fragment,
      );
      const parsed = new win.DOMParser().parseFromString(next, "text/html");
      main.innerHTML = parsed.querySelector("main")!.innerHTML;
    }
    const entry = routedEntries(this.model).find(
      (entry) => entry.id === this.selection.screenId,
    );
    const url = new URL(entry ? `/view/${entry.route}` : "/", this.baseUrl);
    if (this.selection.variantId)
      url.searchParams.set("variant", this.selection.variantId);
    if (this.route.fragment)
      url.searchParams.set("fragment", this.route.fragment);
    this.scope.setUrl(url);
    this.root.dataset["moklyStatic"] = "";
    this.root.dataset["moklyDelivery"] = JSON.stringify({
      schemaVersion: 2,
      deploymentId: this.model.deploymentId,
      canonicalPath: url.pathname,
      idRoutes: Object.fromEntries(
        routedEntries(this.model).map((entry) => [
          entry.id,
          `/view/${entry.route}`,
        ]),
      ),
      comparisonUrl: this.model.comparisonUrl
        ? `/${this.model.comparisonUrl}`
        : null,
    });
    syncSelection(doc, this.selection, routeChanged && entry ? url : undefined);
    const workspaceUpdated = !routeChanged && variantChanged;
    if (workspaceUpdated) this.workspace.setVariant(this.selection.variantId);
    this.frames.update(
      this.selection,
      this.selection.variantId,
      this.route.fragment,
    );
    this.identify();
    if (routeChanged)
      this.workspace = installWorkspace(
        doc,
        win,
        this.diffs.update,
        () => {},
        this.frames,
        (variantId) => this.select({ variantId }),
      );
    this.slots.update();
    if (!workspaceUpdated) this.diffs.update();
  }
  refreshLayout(): void {
    this.slots.update();
  }
  async highlightInstance(
    instance: Parameters<MoklyViewerHandle["highlightInstance"]>[0],
  ): Promise<void> {
    await this.highlightInstances(instance ? [instance] : []);
  }
  async highlightInstances(
    instances: Parameters<MoklyViewerHandle["highlightInstances"]>[0],
  ): Promise<void> {
    try {
      await this.frames.highlightInstances(instances);
    } catch (error) {
      throw this.error(error, "frame");
    }
  }
  async scrollToInstance(
    instance: Parameters<MoklyViewerHandle["scrollToInstance"]>[0],
  ): Promise<void> {
    try {
      await this.frames.scroll(instance);
    } catch (error) {
      throw this.error(error, "frame");
    }
  }
  startPick(): Promise<void> {
    return this.frames.startPick();
  }
  cancelPick(): void {
    this.frames.end({ reason: "cancelled" });
  }
  dispose(reason?: "source-change"): void {
    if (this.disposed) return;
    this.disposed = true;
    runCleanup([
      () => this.frames.dispose(reason),
      () => this.workspace.dispose(),
      () => this.diffs.reset(),
      () => this.stopResize(),
      () => this.slots.dispose(),
      () => this.scope.dispose(),
    ]);
  }
}
