import { waitFor } from "./process.js";
import type { Running } from "./process.js";
import type { TimingRecord } from "./timings.js";

export interface WarmSeedResult {
  measured: false;
  storeState: "idle" | "not-observed";
  completion: TimingRecord["event"] | null;
  states: TimingRecord["event"][];
  elapsedMs: number;
}

export async function prepareWarmSeed(
  running: Running,
): Promise<WarmSeedResult> {
  const beginning = performance.now();
  let completion: TimingRecord["event"] | null = null;
  let states: TimingRecord["event"][] = [];
  const output = () => {
    completion =
      running.timings.find(
        ({ event }) =>
          event.role === "core" &&
          event.stage === "changes.classify" &&
          event.event === "end" &&
          event.status === "ok" &&
          typeof event.session === "string" &&
          typeof event.pid === "number",
      )?.event ?? null;
    if (!completion) return "";
    const latest = new Map<string, TimingRecord["event"]>();
    for (const { event } of running.timings) {
      if (
        event.stage !== "render.store" ||
        event.event !== "state" ||
        event.role !== "core" ||
        event.session !== completion.session ||
        event.pid !== completion.pid ||
        typeof event.sequence !== "number" ||
        !Number.isSafeInteger(event.sequence) ||
        event.sequence < 0
      )
        continue;
      const key = `${event.session}:${event.pid}`;
      const previous = latest.get(key);
      if (!previous || Number(previous.sequence) < event.sequence)
        latest.set(key, event);
    }
    states = [...latest.values()];
    return states.every((event) => event.queued === 0 && event.active === 0)
      ? "warm seed ready"
      : "";
  };
  await waitFor({ ...running, output }, /^warm seed ready$/u);
  return {
    measured: false,
    storeState: states.length ? "idle" : "not-observed",
    completion,
    states,
    elapsedMs: performance.now() - beginning,
  };
}
