import assert from "node:assert/strict";
import { test } from "node:test";

import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { ComponentMaterialReader } from "../dist/review/component_resources.js";

test("prefetch retains empty files and discovers resources only when requested", async () => {
  const reads: string[] = [];
  const reader = new ComponentMaterialReader({
    readMany: async (routes) =>
      new Map(
        routes.map((route) => {
          if (route === "view.html") return [route, Buffer.alloc(0)];
          reads.push(route);
          assert.equal(route, "used.css");
          return [route, Buffer.from('@import "./used.css";')];
        }),
      ),
    read: async (route) => {
      reads.push(route);
      assert.equal(route, "used.css");
      return Buffer.from('@import "./used.css";');
    },
  });
  await reader.prefetch(["view.html"]);
  assert.equal(await reader.text("view.html"), "");
  assert.deepEqual(reads, []);
  for (let index = 0; index < 2; index++)
    assert.deepEqual(
      await reader.resources(
        "view.html",
        '<link rel="stylesheet" href="used.css"><link rel="stylesheet" href="excluded.css"><link rel="prefetch" href="hint.css">',
        (route) => route === "excluded.css",
      ),
      new Set(["used.css"]),
    );
  assert.deepEqual(reads, ["used.css"]);
});

test("prefetch rejects an omitted view instead of falling back to unvalidated bytes", async () => {
  const reader = new ComponentMaterialReader({
    readMany: async () => new Map(),
    read: async () => assert.fail("An incomplete batch must fail"),
  });
  await assert.rejects(reader.prefetch(["missing.html"]), {
    code: "review-invalid",
    message: /missing.html: batch reader omitted the file/,
  });
});

test("resource discovery caches each document and exclusion policy", async () => {
  const reader = new ComponentMaterialReader({
    read: async () => Buffer.from(""),
  });
  const events: TimingEvent[] = [];
  const html = '<link rel="stylesheet" href="used.css">';
  const excluded = (route: string) => route === "excluded.css";
  await runWithTimings(
    true,
    "test",
    async () => {
      await reader.resources("view.html", html);
      await reader.resources("view.html", html);
      await reader.resources("view.html", html, excluded);
      await reader.resources("view.html", html, excluded);
    },
    { write: (event) => events.push(event) },
  );
  assert.equal(
    events.filter(
      (event) =>
        event.stage === "review.resource-graph" && event.event === "start",
    ).length,
    2,
  );
});
