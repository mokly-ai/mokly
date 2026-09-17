import type { CatalogueReadModel } from "../catalogue/types.js";
import type {
  FrameAdapter,
  FrameEvent,
  FrameNavigation,
} from "../client/frame_adapter.js";
import { FrameError } from "../client/frame_error.js";
import { cancelFrameMount } from "../client/frame_mount.js";

import { runCleanup } from "./cleanup.js";
import { FrameHighlights } from "./frame_highlights.js";
import { frameSession, refreshFrameSessions } from "./frame_session.js";
import type { Session } from "./frame_session.js";
import { frameDescriptors, frameInstance, hasInstance } from "./frame_views.js";
import type { ViewerFrame } from "./frame_views.js";
import { GeometryRefresh } from "./geometry_refresh.js";
import {
  inspectionScope,
  readyInspection,
  validInspection,
} from "./inspection_scope.js";
import { MarkerStore } from "./marker_store.js";
import { FrameMarkers } from "./markers.js";
import { Picking } from "./picking.js";
import type {
  InstanceRef,
  PickEnd,
  ViewerEvents,
  ViewerMarker,
  ViewerSelection,
} from "./types.js";

export class ViewerFrames {
  private sessions: Session[] = [];
  private disposed = false;
  private pick: Picking;
  private highlights: FrameHighlights;
  private geometry: GeometryRefresh;
  private markers: FrameMarkers;
  private stopGeometry: () => void;
  private choose:
    ((key: string, viewport: "mobile" | "desktop") => void) | undefined;
  constructor(
    private root: HTMLElement,
    private model: CatalogueReadModel,
    private origin: URL,
    private adapter: FrameAdapter,
    private events: () => ViewerEvents,
    private navigate: (event: FrameNavigation) => void,
    private selection: ViewerSelection,
    private report: (error: unknown) => Error,
    markerStore = new MarkerStore(),
    reportMarker: (error: unknown) => Error = report,
  ) {
    this.geometry = new GeometryRefresh(root);
    this.highlights = new FrameHighlights(
      root,
      model,
      () => this.sessions,
      this.geometry,
      () => !this.disposed,
      (frame, event) => this.receive(frame, event),
      (error) => this.fail(error),
    );
    this.markers = new FrameMarkers(
      root,
      this.geometry,
      () => this.sessions,
      markerStore,
      events,
      reportMarker,
    );
    this.geometry.setDemand(() => [
      ...new Set([...this.highlights.demand(), ...this.markers.demand()]),
    ]);
    this.stopGeometry = this.geometry.subscribe(() => {
      void this.highlights.labels().catch(() => {});
      this.markers.changed();
    });
    this.pick = new Picking(
      events,
      () => !this.disposed,
      () => {
        void this.highlights.off().catch(() => {});
      },
      report,
    );
  }
  update(
    selection: ViewerSelection,
    variant?: string,
    fragment?: string,
  ): void {
    this.selection = selection;
    const frames = frameDescriptors(
      this.root,
      this.model,
      selection,
      variant,
      fragment,
    );
    if (
      refreshFrameSessions(
        this.sessions,
        frames,
        (error) => this.fail(error),
        (changed) => {
          this.geometry.supersede(changed);
          this.highlights.evidence(changed, this.pick.activating, () =>
            this.end({ reason: "evidence" }),
          );
          void this.geometry.refresh(changed).catch(() => {});
          this.markers.changed();
        },
      )
    )
      return;
    runCleanup([() => this.end({ reason: "navigation" }), () => this.clear()]);
    for (const frame of frames) {
      const url = new URL(frame.url, this.origin);
      this.sessions.push(
        frameSession(
          frame,
          url,
          this.adapter,
          (event) => this.receive(frame, event),
          (error) => this.fail(error),
        ),
      );
    }
    this.geometry.sync(this.sessions);
    void this.geometry.refresh().catch(() => {});
    this.markers.changed();
  }
  private receive(frame: ViewerFrame, event: FrameEvent): void {
    if (
      this.disposed ||
      !this.sessions.some((session) => session.frame === frame)
    )
      return;
    if (event.type === "navigation") {
      this.navigate(event.navigation);
      return;
    }
    if (event.type === "pick-end") {
      this.end({ reason: "escape" });
      return;
    }
    if (event.type === "error") {
      this.fail();
      return;
    }
    if (event.type === "geometry") {
      const session = this.sessions.find((item) => item.frame === frame);
      if (session) void this.geometry.refresh([session]).catch(() => {});
      return;
    }
    if (event.key !== null && !hasInstance(frame.view?.usage, event.key)) {
      this.fail();
      return;
    }
    const instance =
      event.key === null ? null : frameInstance(frame, event.key);
    const detail = {
      instance,
      boxes: event.boxes,
      frame: {
        entryId: this.selection.screenId ?? frame.entry.id,
        ...(frame.stepIndex !== undefined
          ? { stepIndex: frame.stepIndex }
          : {}),
      },
    };
    if (event.type === "hover") this.events().onInstanceHover?.(detail);
    else if (instance) {
      this.events().onInstanceClick?.(detail);
      if (this.pick.active) this.end({ reason: "selected", instance });
      this.choose?.(instance.key, instance.viewport);
    }
  }
  private fail(error: unknown = new Error("Frame unavailable")): Error {
    this.pick.end({ reason: "error" }, error);
    return this.report(error);
  }
  async highlight(instance: InstanceRef | null): Promise<void> {
    await this.highlightInstances(instance ? [instance] : []);
  }
  async highlightInstances(instances: readonly InstanceRef[]): Promise<void> {
    if (!instances.length) {
      await this.highlights.off();
      return;
    }
    const request = {
      kind: "instances" as const,
      instances: instances.map((instance) => ({ ...instance })),
    };
    const work = this.highlights.work();
    const scope = inspectionScope(this.sessions, request);
    try {
      await work.run(async () => {
        if (!scope.complete) throw new FrameError("missing-instance");
        await readyInspection(this.root, scope.sessions, work);
        work.check();
        if (!validInspection(scope)) throw new FrameError("missing-instance");
      });
    } catch (error) {
      throw this.report(error);
    }
    await this.highlights.show(request, "highlight");
  }
  async scroll(instance: InstanceRef): Promise<void> {
    const work = this.highlights.work();
    const { sessions } = inspectionScope(this.sessions, {
      kind: "instance",
      instance,
    });
    await work.run(
      async () => {
        await readyInspection(this.root, sessions, work);
        work.check();
        await sessions[0]!.mounted!.scrollTo(instance.key);
      },
      (error) => this.fail(error),
    );
  }
  startPick(): Promise<void> {
    return this.pick.start(async (valid) => {
      await this.highlights.show({ kind: "workspace", key: undefined }, "pick");
      if (valid()) this.root.focus({ preventScroll: true });
    });
  }
  end(event: PickEnd): void {
    this.pick.end(event);
  }
  workspaceHighlight(
    selected: string | undefined,
    choose: (key: string, viewport: "mobile" | "desktop") => void,
  ): () => void {
    this.choose = choose;
    void this.highlights
      .show(
        { kind: "workspace", key: selected },
        this.pick.active ? "pick" : "highlight",
      )
      .catch(() => {});
    return () => {
      this.choose = undefined;
      if (!this.pick.active) {
        void this.highlights.off().catch(() => {});
      }
    };
  }
  workspaceReveal(key: string, viewport: "mobile" | "desktop"): void {
    const frame = this.sessions.find(
      (session) =>
        session.frame.view?.viewport === viewport &&
        hasInstance(session.frame.view?.usage, key),
    )?.frame;
    if (frame) void this.scroll(frameInstance(frame, key)).catch(() => {});
  }
  updateMarkers(markers: readonly ViewerMarker[]): void {
    this.markers.update(markers);
  }
  refreshGeometry(): void {
    this.markers.changed();
    void this.geometry.refresh().catch(() => {});
  }
  private clear(): void {
    const sessions = this.sessions;
    this.sessions = [];
    this.choose = undefined;
    this.highlights.reset();
    this.geometry.sync([]);
    this.markers.changed();
    runCleanup(
      sessions.flatMap((session) => [
        () => session.controller.abort(),
        () => session.unsubscribe?.(),
        () => session.mounted?.dispose(),
        () => cancelFrameMount(session.frame.element),
      ]),
    );
  }
  dispose(reason?: "source-change"): void {
    if (this.disposed) return;
    runCleanup([
      () => {
        if (reason) this.end({ reason });
      },
      () => {
        this.disposed = true;
        this.pick.end();
      },
      () => this.stopGeometry(),
      () => this.markers.dispose(),
      () => this.clear(),
      () => this.geometry.dispose(),
    ]);
  }
}
