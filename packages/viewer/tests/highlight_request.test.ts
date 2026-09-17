import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import type { CatalogueUsage } from "../src/catalogue/types.js";
import type { MountedFrame } from "../src/client/frame_adapter.js";
import type { Session } from "../src/viewer/frame_session.js";
import type { ViewerFrame } from "../src/viewer/frame_views.js";
import { highlightKeys } from "../src/viewer/highlight_request.js";
import {
  inspectionScope,
  validInspection,
} from "../src/viewer/inspection_scope.js";
import type { InstanceRef } from "../src/viewer/types.js";

const model = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);
const alpha = "a".repeat(64);
const beta = "b".repeat(64);

const usage: CatalogueUsage = {
  status: "ready",
  instances: [alpha, beta].map((key, order) => ({
    key,
    id: order === 0 ? "alpha" : "beta",
    componentId: "action",
    owner: { kind: "entry" as const },
    order,
    props: {},
    propsKey: key,
  })),
  slots: [],
  ranges: [alpha, beta].map((instanceKey, index) => ({
    id: `r-${index}`,
    target: { kind: "instance" as const, instanceKey },
  })),
};

function session(viewport: "mobile" | "desktop"): Session {
  const frame: ViewerFrame = {
    element: {} as HTMLIFrameElement,
    entry: model.screens[0]!,
    view: {
      viewport,
      colorScheme: "light",
      fragmentPath: `screens/home.${viewport}.html`,
      usage,
      comparison: { status: "disabled" },
    },
    url: `/static/screens/home.${viewport}.html`,
  };
  const mounted: MountedFrame = {
    listInstanceBoundaries: async () => [],
    highlight: async () => {},
    scrollTo: async () => {},
    subscribe: () => () => {},
    dispose: () => {},
  };
  return {
    frame,
    usage,
    usageRevision: 0,
    ready: Promise.resolve(mounted),
    mounted,
    controller: new AbortController(),
  };
}

function reference(viewport: "mobile" | "desktop", key: string): InstanceRef {
  return {
    screenId: "home",
    viewport,
    colorScheme: "light",
    key,
  };
}

test("multi-instance scope partitions deduplicated keys across exact sessions", () => {
  const mobile = session("mobile");
  const desktop = session("desktop");
  const request = {
    kind: "instances" as const,
    instances: [
      reference("mobile", alpha),
      reference("mobile", alpha),
      reference("mobile", beta),
      reference("desktop", beta),
    ],
  };
  assert.deepEqual(highlightKeys(mobile.frame, request), [alpha, beta]);
  assert.deepEqual(highlightKeys(desktop.frame, request), [beta]);
  const scope = inspectionScope([mobile, desktop], request);
  assert.equal(scope.complete, true);
  assert.deepEqual(scope.sessions, [mobile, desktop]);
  assert.deepEqual(scope.keys.get(mobile), [alpha, beta]);
  assert.deepEqual(scope.keys.get(desktop), [beta]);
  assert.equal(validInspection(scope), true);
});

test("multi-instance scope rejects one unmatched ref and detects later evidence loss", () => {
  const mobile = session("mobile");
  const desktop = session("desktop");
  const request = {
    kind: "instances" as const,
    instances: [reference("mobile", alpha), reference("desktop", beta)],
  };
  const scope = inspectionScope([mobile, desktop], request);
  assert.equal(validInspection(scope), true);
  desktop.frame.view = {
    ...desktop.frame.view!,
    usage: { status: "ready", instances: [], slots: [], ranges: [] },
  };
  assert.equal(validInspection(scope), false);
  const unmatched = inspectionScope([mobile, desktop], {
    ...request,
    instances: [...request.instances, reference("desktop", "c".repeat(64))],
  });
  assert.equal(unmatched.complete, false);
  assert.equal(validInspection(unmatched), false);
});
