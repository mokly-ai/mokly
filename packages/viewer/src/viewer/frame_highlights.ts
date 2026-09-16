import type { CatalogueReadModel } from "../catalogue/types.js";
import type { FrameEvent } from "../client/frame_adapter.js";

import { renderFrameLabels } from "./frame_labels.js";
import type { Session } from "./frame_session.js";
import type { ViewerFrame } from "./frame_views.js";
import { highlightKeys } from "./highlight_request.js";
import type { HighlightRequest } from "./highlight_request.js";

/** One inspection request owns masks, host labels and their asynchronous lifetime. */
export class FrameHighlights {
  private request: HighlightRequest | undefined;
  private revision = 0;
  constructor(
    private root: HTMLElement,
    private model: CatalogueReadModel,
    private sessions: () => readonly Session[],
    private current: () => Promise<Session[]>,
    private receive: (frame: ViewerFrame, event: FrameEvent) => void,
  ) {}
  reset(): void {
    this.revision++;
    this.request = undefined;
    this.root.querySelector("[data-mokly-label-layer]")?.replaceChildren();
  }
  async off(): Promise<void> {
    this.reset();
    await Promise.all(
      this.sessions().map((session) => session.mounted?.highlight([], "off")),
    );
  }
  async show(
    request: HighlightRequest,
    mode: "pick" | "highlight",
  ): Promise<void> {
    const revision = ++this.revision;
    const sessions = await this.current();
    if (revision !== this.revision)
      throw new Error("The selected view changed.");
    this.request = request;
    await Promise.all(
      sessions.map(({ frame, mounted }) => {
        const keys = highlightKeys(frame, request);
        return mounted!.highlight(
          keys,
          request.kind === "instance" && !keys.length ? "off" : mode,
        );
      }),
    );
    if (revision === this.revision) await this.labels();
  }
  async labels(): Promise<void> {
    const request = this.request,
      revision = this.revision;
    if (!request) return;
    const sessions = await this.current();
    await renderFrameLabels(
      this.root,
      sessions,
      this.model,
      request,
      () => this.request === request && revision === this.revision,
      this.receive,
    );
  }
}
