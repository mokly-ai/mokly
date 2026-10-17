import { StringDecoder } from "node:string_decoder";

export interface TimingRecord {
  event: { schemaVersion: 1; stage: string; [key: string]: unknown };
  receivedMs: number;
}
/** Chunk boundaries and child elapsed clocks do not change observer timestamps. */
export function timingCollector(now = () => performance.now()) {
  const decoder = new StringDecoder("utf8");
  let partial = "";
  const records: TimingRecord[] = [];
  return {
    records,
    accept(chunk: string | Uint8Array) {
      const lines = (
        partial +
        (typeof chunk === "string" ? chunk : decoder.write(Buffer.from(chunk)))
      ).split("\n");
      partial = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("[mokly:timing] ")) continue;
        try {
          const event = JSON.parse(line.slice("[mokly:timing] ".length));
          if (event?.schemaVersion === 1 && typeof event.stage === "string")
            records.push({ event, receivedMs: now() });
        } catch {
          continue;
        }
      }
    },
  };
}
