/** Latest-wins repository classification for a watched catalogue. */

import type { Manifest } from "@mokly/viewer/data";

import type { ResolvedConfig } from "../config/types.js";
import { timeAsync, timingCounts } from "../diagnostics/timings.js";

import type {
  CatalogueChangeClassifier,
  ComponentChangeSnapshot,
} from "./component_changes.js";

/** Own cancellation and publication ordering for background Changes evidence. */
export class WatchClassification {
  private active: AbortController | undefined;
  private closed = false;
  private sequence = 0;

  constructor(
    private readonly classifier: CatalogueChangeClassifier,
    private readonly publish: (snapshot: ComponentChangeSnapshot) => void,
  ) {}

  /** Replace any active calculation with the current immutable generation. */
  schedule(config: ResolvedConfig, manifest: Manifest, base: string): void {
    if (this.closed) return;
    this.active?.abort();
    const controller = new AbortController();
    this.active = controller;
    const sequence = ++this.sequence;
    void timeAsync("changes.classify", () =>
      this.classifier.read(config, manifest, base, controller.signal),
    )
      .then((snapshot) => {
        if (this.closed || sequence !== this.sequence || !snapshot) return;
        timingCounts("changes.publish", () => ({
          changedRoutes: snapshot.changedRoutes?.length ?? 0,
        }));
        this.publish(snapshot);
      })
      .catch(() => undefined)
      .finally(() => {
        if (this.active === controller) this.active = undefined;
      });
  }

  /** Prevent publication and abort any Git subprocess still in flight. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.sequence += 1;
    this.active?.abort();
    this.active = undefined;
  }
}
