import type { Request } from "../generated/sidecar/Request.js";

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
export class Timings {
  private origin: number | undefined;
  private next = 0;

  constructor(
    private readonly clock: Clock,
    private readonly write: (line: string) => void,
    private readonly pid: number,
    private readonly session: string,
  ) {}

  enable(enabled: boolean): void {
    this.origin = enabled ? this.clock.now() : undefined;
  }

  received(): number {
    return this.origin === undefined ? 0 : this.clock.now();
  }

  begin(
    request: Pick<Request, "method">,
    received: number,
  ): (status: "ok" | "error") => void {
    const fields = stages[request.method];
    const origin = this.origin;
    if (origin === undefined || !fields) return () => {};
    const common = {
      schemaVersion: 1,
      session: this.session,
      pid: this.pid,
      role: "sidecar",
      ...fields,
      id: ++this.next,
    };
    this.write(
      `[mokly:timing] ${JSON.stringify({ ...common, event: "start", elapsedMs: received - origin })}\n`,
    );
    return (status) => {
      const ended = this.clock.now();
      this.write(
        `[mokly:timing] ${JSON.stringify({ ...common, event: "end", elapsedMs: ended - origin, durationMs: ended - received, status })}\n`,
      );
    };
  }
}
