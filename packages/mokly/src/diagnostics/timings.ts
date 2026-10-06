/** Opt-in process-local spans; diagnostics never contain consumer documents or props. */
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

export interface TimingEvent {
  schemaVersion: 1;
  session: string;
  pid: number;
  role: string;
  event: "start" | "end" | "counts";
  stage: string;
  id: number;
  parentId?: number;
  elapsedMs: number;
  durationMs?: number;
  status?: "ok" | "error";
  cacheHit?: boolean;
  counts?: Readonly<Record<string, number>>;
}

interface TimingSink {
  clock?: () => number;
  write?: (event: TimingEvent) => void;
}

interface Session {
  id: string;
  role: string;
  origin: number;
  sequence: number;
  clock: () => number;
  write: (event: TimingEvent) => void;
}

interface Context {
  session: Session;
  parentId?: number;
}

const storage = new AsyncLocalStorage<Context | undefined>();

/** Scope profiling to one CLI invocation, including its later asynchronous work. */
export function runWithTimings<T>(
  enabled: boolean,
  role: string,
  operation: () => T,
  sink: TimingSink = {},
): T {
  if (!enabled) return storage.run(undefined, operation);
  const clock = sink.clock ?? (() => performance.now());
  return storage.run(
    {
      session: {
        id: randomUUID(),
        role,
        clock,
        origin: clock(),
        sequence: 0,
        write:
          sink.write ??
          ((event) =>
            process.stderr.write(`[mokly:timing] ${JSON.stringify(event)}\n`)),
      },
    },
    operation,
  );
}

/** Bind an external emitter callback to the session in which it was registered. */
export function bindTimings<T extends (...args: never[]) => unknown>(
  callback: T,
): T {
  return storage.getStore() ? AsyncLocalStorage.bind(callback) : callback;
}

/** Forward opt-in diagnostics to a supervised child without global environment state. */
export function timingArguments(): readonly string[] {
  return storage.getStore() ? ["--debug-timings"] : [];
}

export function timeSync<T>(stage: string, operation: () => T): T {
  const context = storage.getStore();
  if (!context) return operation();
  const span = begin(context, stage);
  return storage.run({ session: context.session, parentId: span.id }, () => {
    try {
      const result = operation();
      span.end("ok");
      return result;
    } catch (error) {
      span.end("error");
      throw error;
    }
  });
}

export async function timeAsync<T>(
  stage: string,
  operation: () => Promise<T>,
  metadata?: (result: T) => { readonly cacheHit?: boolean },
): Promise<T> {
  const context = storage.getStore();
  if (!context) return operation();
  const span = begin(context, stage);
  return storage.run(
    { session: context.session, parentId: span.id },
    async () => {
      try {
        const result = await operation();
        let details: { readonly cacheHit?: boolean } | undefined;
        try {
          details = metadata?.(result);
        } catch {
          // Diagnostics must not change the operation's outcome.
        }
        span.end("ok", details);
        return result;
      } catch (error) {
        span.end("error");
        throw error;
      }
    },
  );
}

/** Calculate aggregate numeric metadata only when diagnostics were explicitly enabled. */
export function timingCounts(
  stage: string,
  counts: () => Readonly<Record<string, number>>,
): void {
  const context = storage.getStore();
  if (!context) return;
  emit(context.session, {
    ...baseEvent(context, stage),
    event: "counts",
    counts: counts(),
  });
}

function begin(context: Context, stage: string) {
  const base = baseEvent(context, stage);
  const started = context.session.clock();
  emit(context.session, { ...base, event: "start" });
  return {
    id: base.id,
    end(status: "ok" | "error", details?: { readonly cacheHit?: boolean }) {
      const now = context.session.clock();
      emit(context.session, {
        ...base,
        event: "end",
        status,
        ...details,
        durationMs: milliseconds(now - started),
        elapsedMs: milliseconds(now - context.session.origin),
      });
    },
  };
}

function baseEvent(context: Context, stage: string) {
  const { session, parentId } = context;
  return {
    schemaVersion: 1 as const,
    session: session.id,
    pid: process.pid,
    role: session.role,
    stage,
    id: ++session.sequence,
    ...(parentId === undefined ? {} : { parentId }),
    elapsedMs: milliseconds(session.clock() - session.origin),
  };
}

function milliseconds(value: number): number {
  return Math.round(value * 100) / 100;
}

function emit(session: Session, event: TimingEvent): void {
  try {
    session.write(event);
  } catch {
    return;
  }
}
