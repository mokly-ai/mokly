import assert from "node:assert/strict";

interface Timing {
  schemaVersion: number;
  session: string;
  pid: number;
  role: string;
  stage: string;
  event: string;
  id: number;
  parentId?: number;
  elapsedMs: number;
  durationMs?: number;
  status?: string;
  side?: "base" | "head";
  reason?: "recycle" | "replacement" | "retry" | "root-switch";
  tier?: number;
  views?: number;
  uncapturedViews?: number;
  retainedBytes?: number;
  encodedBytes?: number;
  unchanged?: number;
  changed?: number;
  ignoredOnly?: number;
  kind?: string;
  phase?: string;
  hits?: number;
  misses?: number;
  evictions?: number;
  chargedBytes?: number;
  entries?: number;
}

export function timings(stderr: string): Timing[] {
  const records = stderr
    .split("\n")
    .filter((line) => line.startsWith("[mokly:timing] "))
    .map((line) => JSON.parse(line.slice(15)) as Timing);
  assert.ok(records.length > 0);
  for (const record of records) {
    assert.equal(record.schemaVersion, 1);
    assert.equal(typeof record.session, "string");
    assert.ok(record.session.length > 0);
    assert.equal(typeof record.pid, "number");
    assert.ok(["core", "sidecar"].includes(record.role));
    assert.equal(typeof record.stage, "string");
    assert.equal(typeof record.id, "number");
    assert.ok(Number.isFinite(record.elapsedMs));
    if (record.event === "state") {
      assert.equal(record.stage, "render.store");
      assert.equal(record.role, "core");
      assert.equal(record.parentId, undefined);
      const fields = new Map<string, unknown>(Object.entries(record));
      for (const name of [
        "sequence",
        "queued",
        "active",
        "hits",
        "misses",
        "faults",
        "writes",
        "bytes",
        "drops",
      ]) {
        const value = fields.get(name);
        assert.ok(
          typeof value === "number" &&
            Number.isSafeInteger(value) &&
            value >= 0,
          `${name} must be a nonnegative safe integer`,
        );
      }
    } else {
      assert.ok(["start", "end", "counts"].includes(record.event));
    }
    if (record.parentId !== undefined)
      assert.equal(typeof record.parentId, "number");
    if (record.event === "end") {
      assert.ok(Number.isFinite(record.durationMs));
      assert.ok(["ok", "error"].includes(record.status!));
    }
  }
  return records;
}
