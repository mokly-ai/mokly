import assert from "node:assert/strict";
import test from "node:test";

import { inputProfile } from "../scripts/large/input_profile.js";
import type { TimingRecord } from "../scripts/large/timings.js";

function record(
  pid: number,
  id: number,
  stage: string,
  event: string,
  parentId?: number,
): TimingRecord {
  return {
    receivedMs: id,
    event: {
      schemaVersion: 1,
      role: "core",
      pid,
      id,
      stage,
      event,
      parentId,
      ...(event === "end" ? { status: "ok" } : {}),
    },
  };
}

test("input observations attribute nested reads to the exact process and CSS root", () => {
  const result = inputProfile(
    [
      record(10, 1, "css.bundle", "start"),
      record(20, 1, "css.bundle", "start"),
      record(10, 2, "css.postcss", "start", 1),
      record(10, 3, "output.input-read", "start", 2),
      record(10, 3, "output.input-read", "end", 2),
      record(10, 2, "css.postcss", "end", 1),
      record(10, 1, "css.bundle", "end"),
      record(20, 1, "css.bundle", "end"),
      record(10, 4, "output.recheck", "start"),
    ],
    [],
  );
  assert.deepEqual(
    result.spans.map((span) => ({
      stage: span.stage,
      pid: span.pid,
      id: span.id,
      status: span.status,
      calls: span.capturedReadCalls,
    })),
    [
      { stage: "css.bundle", pid: 10, id: 1, status: "ok", calls: 1 },
      { stage: "css.bundle", pid: 20, id: 1, status: "ok", calls: null },
      {
        stage: "output.recheck",
        pid: 10,
        id: 4,
        status: "incomplete",
        calls: null,
      },
    ],
  );
});

test("malformed parent cycles and missing identities cannot invent a CSS owner", () => {
  const records = [
    record(10, 1, "css.postcss", "start", 1),
    record(10, 2, "output.input-read", "end", 1),
    record(10, 3, "output.fingerprint", "start"),
    record(10, 3, "output.fingerprint", "end"),
  ];
  records.push({
    receivedMs: 0,
    event: {
      schemaVersion: 1,
      stage: "css.bundle",
      event: "start",
      role: "core",
    },
  });
  const result = inputProfile(records, []);
  assert.deepEqual(
    result.spans.map((span) => span.stage),
    ["output.fingerprint"],
  );
  assert.equal(result.spans[0]?.capturedReadCalls, null);
});
