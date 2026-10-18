/** Correlate static input spans with observed process memory, without budgets. */
import type { MemoryObservation } from "./memory.js";
import type { TimingRecord } from "./timings.js";

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function identity(record: TimingRecord, id = record.event.id) {
  return `${record.event.pid}:${id}`;
}

function memoryWindow(
  samples: readonly MemoryObservation[],
  first: number,
  last: number,
) {
  let before = 0;
  for (let index = 0; index < samples.length; index++) {
    if (samples[index]!.receivedMs > first) break;
    before = index;
  }
  let after = samples.findIndex((sample) => sample.receivedMs >= last);
  if (after < 0) after = samples.length - 1;
  const window = samples.slice(before, after + 1);
  return {
    rssSamples: window.length,
    cliPeakKiB: window.length
      ? Math.max(...window.map((sample) => sample.cliKiB))
      : null,
    harnessPeakKiB: window.length
      ? Math.max(...window.map((sample) => sample.harnessKiB))
      : null,
  };
}

export function inputProfile(
  records: readonly TimingRecord[],
  memory: readonly MemoryObservation[],
) {
  const starts = new Map<string, TimingRecord>();
  const ends = new Map<string, TimingRecord>();
  const retainedByProcess = new Map<unknown, number>();
  const retainedAtEnd = new Map<string, number | null>();
  for (const record of records) {
    if (
      record.event.role !== "core" ||
      number(record.event.id) === null ||
      number(record.event.pid) === null
    )
      continue;
    const retained = number(record.event.retainedBytes);
    if (retained !== null) retainedByProcess.set(record.event.pid, retained);
    if (record.event.event === "start") starts.set(identity(record), record);
    if (record.event.event === "end") {
      ends.set(identity(record), record);
      retainedAtEnd.set(
        identity(record),
        retainedByProcess.get(record.event.pid) ?? null,
      );
    }
  }
  const reads = new Map<string, { calls: number; bytes: number }>();
  for (const record of ends.values()) {
    if (record.event.stage !== "output.input-read") continue;
    let parent = starts.get(identity(record, record.event.parentId));
    const seen = new Set<string>();
    while (parent && !seen.has(identity(parent))) {
      seen.add(identity(parent));
      if (parent.event.stage === "css.bundle") {
        const key = identity(parent);
        const total = reads.get(key) ?? { calls: 0, bytes: 0 };
        total.calls++;
        total.bytes += number(record.event.readBytes) ?? 0;
        reads.set(key, total);
        break;
      }
      parent = starts.get(identity(parent, parent.event.parentId));
    }
  }
  const selected = new Set([
    "output.fingerprint",
    "output.input-digests",
    "output.recheck",
    "graph.prepare",
    "css.bundle",
  ]);
  const spans = [...starts.values()]
    .filter((record) => selected.has(record.event.stage))
    .map((start) => {
      const key = identity(start);
      const end = ends.get(key);
      const event = end?.event;
      return {
        stage: start.event.stage,
        pid: start.event.pid,
        id: start.event.id,
        parentId: start.event.parentId ?? null,
        status: event?.status ?? "incomplete",
        durationMs: number(event?.durationMs),
        inputPaths: number(event?.inputPaths),
        retainedSourceBytes:
          number(event?.retainedBytes) ?? retainedAtEnd.get(key) ?? null,
        capturedReadCalls: reads.get(key)?.calls ?? null,
        capturedReadBytes: reads.get(key)?.bytes ?? null,
        ...memoryWindow(
          memory,
          start.receivedMs,
          end?.receivedMs ?? memory.at(-1)?.receivedMs ?? start.receivedMs,
        ),
      };
    });
  return {
    memoryScope:
      "RSS samples bracketing the received span; shared pages can be counted twice",
    retentionScope:
      "Private source payload per captured path; excludes metadata and other owners",
    readScope:
      "Reads reaching CapturedTree; inner cache hits and bundle copies are excluded",
    spans,
  };
}
