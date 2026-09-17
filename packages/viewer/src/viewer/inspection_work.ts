import { FrameError } from "../client/frame_error.js";

/** Internal cancellation is distinct from a current adapter reporting disposal. */
export class ObsoleteInspection extends FrameError {
  constructor() {
    super("disposed");
  }
}

/** A request fences both effects and caller completion, even for custom adapters. */
export class InspectionWork {
  constructor(
    private signal: AbortSignal,
    private available: () => boolean,
  ) {}
  current = (): boolean => !this.signal.aborted && this.available();
  check(): void {
    if (!this.current()) throw new ObsoleteInspection();
  }
  async run<T>(
    action: () => Promise<T>,
    fail?: (error: unknown) => Error,
  ): Promise<T> {
    this.check();
    let abort = () => {};
    const cancelled = new Promise<never>((_resolve, reject) => {
      abort = () => reject(new ObsoleteInspection());
      this.signal.addEventListener("abort", abort, { once: true });
    });
    try {
      const result = await Promise.race([action(), cancelled]);
      this.check();
      return result;
    } catch (error) {
      this.check();
      throw error instanceof ObsoleteInspection || !fail ? error : fail(error);
    } finally {
      this.signal.removeEventListener("abort", abort);
    }
  }
}

export class InspectionOwnership {
  private cancellation = new AbortController();
  constructor(private available: () => boolean) {}
  reset(): void {
    this.cancellation.abort();
    this.cancellation = new AbortController();
  }
  work(): InspectionWork {
    return new InspectionWork(this.cancellation.signal, this.available);
  }
}
