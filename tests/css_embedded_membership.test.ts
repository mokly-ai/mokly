import assert from "node:assert/strict";
import test from "node:test";

import { ComponentMaterialReader } from "../dist/review/component_resources.js";
import { CssResourceAnalysis } from "../dist/review/css/resource_analysis.js";
import { ResourceComparison } from "../dist/review/resource_comparison.js";
import { ChangedResourceGraph } from "../dist/server/changed_resources.js";

import { fixtureCssAnalysis } from "./helpers/css_evidence.js";

for (const embedded of [true, false])
  test(`CSS only matches documents that reach its stylesheet, embedded=${embedded}`, async () => {
    const host = `<html><head>${embedded ? "" : '<link rel="stylesheet" href="style.css">'}</head><body><p class="host">Host</p><iframe src="frame.html"></iframe></body></html>`;
    const frame = `<html><head>${embedded ? '<link rel="stylesheet" href="style.css">' : ""}</head><body><p class="frame">Frame</p></body></html>`;
    const selector = embedded ? ".host" : ".frame";
    const reader = (color: string) => {
      const read = async (route: string) =>
        Buffer.from(
          route === "frame.html" ? frame : `${selector}{color:${color}}`,
        );
      return new ComponentMaterialReader({ read, readIfExists: read });
    };
    const comparison = new ResourceComparison(
      reader("red"),
      reader("blue"),
      new Set(["style.css"]),
      "",
    );
    const evidence = await comparison.compare(
      { path: "host.html", html: host },
      { path: "host.html", html: host },
    );
    assert.equal(evidence.reasons, undefined);
    assert.deepEqual(evidence.excludedResources, [
      { path: "style.css", reason: "no-matching-rule" },
    ]);
  });

test("live page CSS cannot match its host when only an embedded document links it", async () => {
  const host =
    '<html><body><b class="host">Host</b><iframe src="frame.html"></iframe></body></html>';
  const frame =
    '<html><head><link rel="stylesheet" href="style.css"></head><body>Frame</body></html>';
  const read = async (route: string, color: string) =>
    Buffer.from(route === "frame.html" ? frame : `.host{color:${color}}`);
  const graph = new ChangedResourceGraph(
    {
      read: (route) => read(route, "blue"),
      readIfExists: (route) => read(route, "blue"),
      readLocated: async (route) => ({
        content: await read(route, "blue"),
        location: {
          logicalPath: `/public/${route}`,
          physicalPath: `/public/${route}`,
          relativePath: route,
          physicalRelativePath: route,
        },
      }),
    },
    {
      read: (route) => read(route, "red"),
      readIfExists: (route) => read(route, "red"),
    },
    new Set(["style.css"]),
    new Map(),
  );
  const evidence = await graph.compare("host.html", host, {
    path: "host.html",
    html: host,
  });
  assert.equal(evidence.reasons, undefined);
  assert.deepEqual(evidence.excludedResources, [
    { path: "style.css", reason: "no-matching-rule" },
  ]);
});

test("lightweight content reuses accepted screen CSS without another rule analysis", async () => {
  let parses = 0;
  const css = new CssResourceAnalysis({
    parse: () => {
      parses++;
      return { status: "parsed", rules: [] };
    },
  });
  const document =
    '<html><head><link rel="stylesheet" href="style.css"></head><body><b class="host">Host</b></body></html>';
  const graph = new ChangedResourceGraph(
    {
      read: async () => Buffer.from(".host{color:blue}"),
      readIfExists: async () => Buffer.from(".host{color:blue}"),
      readLocated: async (route) => ({
        content: Buffer.from(".host{color:blue}"),
        location: {
          logicalPath: `/public/${route}`,
          physicalPath: `/public/${route}`,
          relativePath: route,
          physicalRelativePath: route,
        },
      }),
    },
    {
      read: async () => Buffer.from(".host{color:red}"),
      readIfExists: async () => Buffer.from(".host{color:red}"),
    },
    new Set(["style.css"]),
    new Map(),
    css,
  );
  const accepted = {
    reasons: [
      {
        kind: "dependency" as const,
        path: "style.css",
        analysis: fixtureCssAnalysis("matched", [".host"]),
      },
    ],
  };
  const evidence = await graph.compare(
    "host.html",
    document,
    { path: "host.html", html: document },
    accepted,
  );
  assert.equal(parses, 0);
  assert.deepEqual(evidence, accepted);
});
