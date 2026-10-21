/** Stable phase names for the PostCSS child timeout diagnostic. */
export type PostcssPhase =
  "spawn" | "config-load" | "plugin-construction" | "stylesheet-run";
type PhaseLineName = PostcssPhase | "module";

type PhaseEvent = "start" | "end";

export interface PhaseRecord {
  phase: PhaseLineName;
  event: PhaseEvent | "module";
  elapsedMs: number;
  durationMs?: number;
  status?: "ok" | "error";
  moduleUrl?: string;
}

interface Clock {
  now(): number;
}

export function phaseLine(record: PhaseRecord): string {
  return `[mokly:postcss-phase] ${JSON.stringify(record)}`;
}

/** Emit deterministic phase records without exposing authored paths or values. */
export class PostcssPhases {
  private readonly origin: number;

  constructor(
    private readonly clock: Clock,
    private readonly write: (line: string) => void,
  ) {
    this.origin = clock.now();
  }

  async run<T>(phase: PostcssPhase, work: () => Promise<T>): Promise<T> {
    const start = this.start(phase);
    try {
      const result = await work();
      start("ok");
      return result;
    } catch (error) {
      start("error");
      throw error;
    }
  }

  start(phase: PostcssPhase): (status: "ok" | "error") => void {
    const received = this.clock.now();
    this.write(
      phaseLine({
        phase,
        event: "start",
        elapsedMs: Math.round(received - this.origin),
      }),
    );
    return (status) => {
      const ended = this.clock.now();
      this.write(
        phaseLine({
          phase,
          event: "end",
          elapsedMs: Math.round(ended - this.origin),
          durationMs: Math.round(ended - received),
          status,
        }),
      );
    };
  }

  moduleUrl(url: string): void {
    this.write(
      phaseLine({
        phase: "module",
        event: "module",
        elapsedMs: Math.round(this.clock.now() - this.origin),
        moduleUrl: url,
      }),
    );
  }
}
