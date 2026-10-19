import type { Request } from "../generated/sidecar/Request.js";

import type { BundlePhase, Measurements } from "./measurements.js";

interface Clock {
  now(): number;
}

const stages: Record<string, { stage: string; kind?: string }> = {
  bundle: { stage: "sidecar.bundle" },
  describe: { stage: "sidecar.describe" },
  processCss: { stage: "sidecar.process-css" },
  renderScreen: { stage: "sidecar.render", kind: "screen" },
  renderComponent: { stage: "sidecar.render", kind: "component" },
  renderStory: { stage: "sidecar.render", kind: "story" },
  renderPage: { stage: "sidecar.render", kind: "page" },
};

/** Session-local records contain method categories and no authored request data. */
export class Timings implements Measurements {
  private origin: number | undefined;
  private next = 0;
  private current: number | undefined;

  constructor(
    private readonly clock: Clock,
    private readonly write: (line: string) => void,
    private readonly pid: number,
    private readonly session: string,
  ) {}

  enable(enabled: boolean): void {
    this.origin = enabled ? this.clock.now() : undefined;
    this.current = undefined;
  }

  received(): number {
    return this.origin === undefined ? 0 : this.clock.now();
  }

  begin(
    request: Pick<Request, "method">,
    received: number,
  ): (status: "ok" | "error") => void {
    const fields = stages[request.method];
    return fields ? this.start(fields, received) : () => {};
  }

  async run<T>(stage: BundlePhase, work: () => Promise<T>): Promise<T> {
    const finish = this.start({ stage }, this.received());
    try {
      const result = await work();
      finish("ok");
      return result;
    } catch (error) {
      finish("error");
      throw error;
    }
  }

  runSync<T>(stage: BundlePhase, work: () => T): T {
    const finish = this.start({ stage }, this.received());
    try {
      const result = work();
      finish("ok");
      return result;
    } catch (error) {
      finish("error");
      throw error;
    }
  }

  private start(
    fields: { stage: string; kind?: string },
    received: number,
  ): (status: "ok" | "error") => void {
    const origin = this.origin;
    if (origin === undefined) return () => {};
    const parentId = this.current;
    this.current = ++this.next;
    const common = {
      schemaVersion: 1,
      session: this.session,
      pid: this.pid,
      role: "sidecar",
      ...fields,
      id: this.current,
      ...(parentId === undefined ? {} : { parentId }),
    };
    this.write(
      `[mokly:timing] ${JSON.stringify({ ...common, event: "start", elapsedMs: received - origin })}\n`,
    );
    return (status) => {
      const ended = this.clock.now();
      this.current = parentId;
      this.write(
        `[mokly:timing] ${JSON.stringify({ ...common, event: "end", elapsedMs: ended - origin, durationMs: ended - received, status })}\n`,
      );
    };
  }
}
