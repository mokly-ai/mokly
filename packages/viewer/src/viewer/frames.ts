import type { CatalogueReadModel } from "../catalogue/types.js";
import type {
  FrameAdapter,
  FrameEvent,
  FrameNavigation,
} from "../client/frame_adapter.js";
import { cancelFrameMount } from "../client/frame_mount.js";

import { runCleanup } from "./cleanup.js";
import { FrameHighlights } from "./frame_highlights.js";
import { frameSession } from "./frame_session.js";
import type { Session } from "./frame_session.js";
import { frameDescriptors, frameInstance, hasInstance } from "./frame_views.js";
import type { ViewerFrame } from "./frame_views.js";
import { inspectionScope, readyInspection } from "./inspection_scope.js";
import { Picking } from "./picking.js";
import type {
  InstanceRef,
  PickEnd,
  ViewerEvents,
  ViewerSelection,
} from "./types.js";

export class ViewerFrames {
  private sessions: Session[] = [];
  private disposed = false;
  private pick: Picking;
  private highlights: FrameHighlights;
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
  ) {
    this.highlights = new FrameHighlights(
      root,
      model,
      () => this.sessions,
      () => !this.disposed,
      (frame, event) => this.receive(frame, event),
      (error) => this.fail(error),
    );
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
      this.sessions.length === frames.length &&
      this.sessions.every(
        (session, i) =>
          session.frame.element === frames[i]?.element &&
          session.frame.view === frames[i]?.view &&
          session.frame.url === frames[i]?.url,
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
      void this.highlights.labels(frame).catch(() => {});
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
    if (instance) {
      await this.highlights.show(
        { kind: "instance", instance: { ...instance } },
        "highlight",
      );
    } else {
      await this.highlights.off();
    }
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
  private clear(): void {
    const sessions = this.sessions;
    this.sessions = [];
    this.choose = undefined;
    this.highlights.reset();
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
      () => this.clear(),
    ]);
  }
}
