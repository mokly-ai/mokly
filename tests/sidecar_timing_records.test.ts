import assert from "node:assert/strict";
import test from "node:test";

import type { Request } from "../packages/mokly/src/generated/sidecar/Request.js";
import { request } from "../packages/mokly/src/sidecar/requests.js";
import { Timings } from "../packages/mokly/src/sidecar/timings.js";

test("hello accepts only an optional boolean timing selector", () => {
  for (const params of [{}, { timings: false }, { timings: true }])
    assert.deepEqual(
      request({ id: 0, method: "hello", params }).params,
      params,
    );
  for (const timings of [null, 0, "true", {}, []])
    assert.throws(
      () => request({ id: 0, method: "hello", params: { timings } }),
      /boolean/u,
    );
});

test("sidecar spans use a fake clock and fixed categories without request data", () => {
  let clock = 100;
  const lines: string[] = [];
  const timing = new Timings(
    { now: () => clock },
    (line) => lines.push(line),
    321,
    "sidecar-session",
  );
  timing.begin({ method: "bundle" }, timing.received())("ok");
  assert.equal(lines.length, 0);
  timing.enable(true);
  const cases: Array<[Request["method"], string, string?]> = [
    ["bundle", "sidecar.bundle"],
    ["describe", "sidecar.describe"],
    ["processCss", "sidecar.process-css"],
    ["renderScreen", "sidecar.render", "screen"],
    ["renderComponent", "sidecar.render", "component"],
    ["renderStory", "sidecar.render", "story"],
    ["renderPage", "sidecar.render", "page"],
  ];
  for (const [index, [method, stage, kind]] of cases.entries()) {
    clock = 150;
    const received = timing.received();
    clock = 160;
    const finish = timing.begin({ method }, received);
    clock = 190;
    const status = index === 1 ? "error" : "ok";
    finish(status);
    const common = {
      schemaVersion: 1,
      session: "sidecar-session",
      pid: 321,
      role: "sidecar",
      stage,
      ...(kind ? { kind } : {}),
      id: index + 1,
    };
    assert.deepEqual(JSON.parse(lines[index * 2]!.slice(15)), {
      ...common,
      event: "start",
      elapsedMs: 50,
    });
    assert.deepEqual(JSON.parse(lines[index * 2 + 1]!.slice(15)), {
      ...common,
      event: "end",
      elapsedMs: 90,
      durationMs: 40,
      status,
    });
  }
  for (const method of ["restoreGeneration", "cssModules", "shutdown"] as const)
    timing.begin({ method }, timing.received())("ok");
  assert.equal(lines.length, 14);
  timing.enable(false);
  timing.begin({ method: "renderPage" }, timing.received())("error");
  assert.equal(lines.length, 14);
});
