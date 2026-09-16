import { ObsoleteInspection } from "./inspection_work.js";
import type { PickEnd, ViewerEvents } from "./types.js";

/** A single cancellable activation shared by all concurrent start requests. */
export class Picking {
  active = false;
  private epoch = 0;
  private cancellation: AbortController | undefined;
  private pending: Promise<void> | undefined;
  constructor(
    private events: () => ViewerEvents,
    private available: () => boolean,
    private off: () => void,
    private report: (error: unknown) => Error,
  ) {}
  start(activate: (valid: () => boolean) => Promise<void>): Promise<void> {
    if (this.active) return Promise.resolve();
    if (this.pending) return this.pending;
    const epoch = ++this.epoch;
    const cancellation = new AbortController();
    this.cancellation = cancellation;
    const valid = () => this.available() && epoch === this.epoch;
    const cancelled = new Promise<never>((_resolve, reject) =>
      cancellation.signal.addEventListener(
        "abort",
        () => reject(cancellation.signal.reason),
        { once: true },
      ),
    );
    const pending = Promise.race([activate(valid), cancelled])
      .then(() => {
        if (!valid()) throw new ObsoleteInspection();
      })
      .catch((error) => {
        if (error instanceof ObsoleteInspection) throw error;
        if (valid()) {
          this.off();
          throw this.report(error);
        }
        throw this.report(
          cancellation.signal.aborted
            ? cancellation.signal.reason
            : new ObsoleteInspection(),
        );
      })
      .then(() => {
        if (!valid()) throw new ObsoleteInspection();
        this.active = true;
        this.events().onPickStart?.();
      });
    this.pending = pending;
    const settled = () => {
      if (this.pending === pending) this.pending = undefined;
    };
    void pending.then(settled, settled);
    return pending;
  }
  end(event?: PickEnd, cause: unknown = new ObsoleteInspection()): void {
    if (!this.active && !this.pending) return;
    this.epoch++;
    this.cancellation?.abort(cause);
    this.cancellation = undefined;
    this.pending = undefined;
    const active = this.active;
    this.active = false;
    this.off();
    if (active && event && this.available()) this.events().onPickEnd?.(event);
  }
}
