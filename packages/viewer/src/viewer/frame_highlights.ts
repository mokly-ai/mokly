import type { CatalogueReadModel } from "../catalogue/types.js";
import type { FrameEvent } from "../client/frame_adapter.js";
import { FrameError } from "../client/frame_error.js";

import { renderFrameLabels } from "./frame_labels.js";
import type { Session } from "./frame_session.js";
import type { ViewerFrame } from "./frame_views.js";
import { highlightKeys } from "./highlight_request.js";
import type { HighlightRequest } from "./highlight_request.js";
import { inspectionScope, readyInspection } from "./inspection_scope.js";
import type { InspectionScope } from "./inspection_scope.js";
import { InspectionOwnership } from "./inspection_work.js";
import type { InspectionWork } from "./inspection_work.js";

/** One inspection request owns masks, host labels and their asynchronous lifetime. */
export class FrameHighlights {
  private scope: InspectionScope | undefined;
  private ownership: InspectionOwnership;
  constructor(
    private root: HTMLElement,
    private model: CatalogueReadModel,
    private sessions: () => readonly Session[],
    available: () => boolean,
    private receive: (frame: ViewerFrame, event: FrameEvent) => void,
    private fail: (error: unknown) => Error,
  ) {
    this.ownership = new InspectionOwnership(available);
  }
  work(): InspectionWork {
    return this.ownership.work();
  }
  reset(): void {
    this.ownership.reset();
    this.scope = undefined;
    this.root.querySelector("[data-mokly-label-layer]")?.replaceChildren();
  }
  async off(): Promise<void> {
    this.reset();
    await this.work().run(() =>
      Promise.all(
        this.sessions().map((session) => session.mounted?.highlight([], "off")),
      ),
    );
  }
  private failed(error: unknown): Error {
    void this.off().catch(() => {});
    return this.fail(error);
  }
  async show(
    request: HighlightRequest,
    mode: "pick" | "highlight",
  ): Promise<void> {
    this.reset();
    const work = this.work();
    const scope = inspectionScope(this.sessions(), request);
    this.scope = scope;
    const { sessions } = scope;
    void Promise.allSettled(
      this.sessions()
        .filter((session) => !sessions.includes(session))
        .map((session) => session.mounted?.highlight([], "off")),
    );
    await work.run(
      async () => {
        await readyInspection(this.root, sessions, work);
        work.check();
        if (
          mode === "pick" &&
          sessions.some(({ frame }) => frame.view?.usage.status !== "ready")
        )
          throw new FrameError("unavailable");
        await Promise.all(
          sessions.map(({ frame, mounted }) =>
            mounted!.highlight(highlightKeys(frame, request), mode),
          ),
        );
        work.check();
        await this.renderLabels(scope, work);
      },
      (error) => this.failed(error),
    );
  }
  async labels(frame?: ViewerFrame): Promise<void> {
    const scope = this.scope;
    if (!scope) return;
    const work = this.work();
    const { sessions } = scope;
    if (frame && !sessions.some((session) => session.frame === frame)) return;
    await work.run(
      async () => {
        await readyInspection(this.root, sessions, work);
        work.check();
        await this.renderLabels(scope, work);
      },
      (error) => this.failed(error),
    );
  }
  private renderLabels(
    scope: InspectionScope,
    work: InspectionWork,
  ): Promise<void> {
    return renderFrameLabels(
      this.root,
      scope,
      this.model,
      work.current,
      this.receive,
    );
  }
}
