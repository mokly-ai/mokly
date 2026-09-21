import assert from "node:assert/strict";
import { test } from "node:test";

import type { CatalogueUsage } from "../src/catalogue/types.js";
import type { MountedFrame } from "../src/client/frame_adapter.js";
import {
  frameHasInstance,
  frameTargetKeys,
  matchFrameInstances,
} from "../src/shell/frame_instances.js";
import type { ShellFrameSession } from "../src/shell/frame_registry.js";
import type { InstanceRef } from "../src/viewer/types.js";

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

function session(
  viewport: "mobile" | "desktop",
  generation: number,
): ShellFrameSession {
  const mounted: MountedFrame = {
    listInstanceBoundaries: async () => [],
    highlight: async () => {},
    scrollTo: async () => {},
    subscribe: () => () => {},
    dispose: () => {},
  };
  return {
    controller: new AbortController(),
    element: {} as HTMLIFrameElement,
    generation,
    identity: {
      entryId: "home",
      route: "screens/home.html",
      viewport,
      colorScheme: "light",
    },
    usage,
    usageRevision: 0,
    ready: Promise.resolve(mounted),
    mounted,
    source: `/static/screens/home.${viewport}.html`,
    status: "ready",
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

test("multi-instance matching partitions deduplicated keys across exact sessions", () => {
  const mobile = session("mobile", 1);
  const desktop = session("desktop", 2);
  const instances = [
    reference("mobile", alpha),
    reference("mobile", alpha),
    reference("mobile", beta),
    reference("desktop", beta),
  ];

  const targets = matchFrameInstances([mobile, desktop], instances);
  assert.deepEqual(
    targets.map(({ session: target }) => target),
    [mobile, mobile, mobile, desktop],
  );
  const keys = frameTargetKeys(targets);
  assert.deepEqual([...keys.get(mobile)!], [alpha, beta]);
  assert.deepEqual([...keys.get(desktop)!], [beta]);
});

test("multi-instance matching rejects one unmatched ref and later evidence loss", () => {
  const mobile = session("mobile", 1);
  const desktop = session("desktop", 2);
  const instances = [reference("mobile", alpha), reference("desktop", beta)];
  assert.equal(matchFrameInstances([mobile, desktop], instances).length, 2);

  desktop.usage = { status: "ready", instances: [], slots: [], ranges: [] };
  assert.equal(frameHasInstance(desktop, beta), false);
  assert.throws(() => matchFrameInstances([mobile, desktop], instances), {
    code: "missing-instance",
  });
  assert.throws(
    () =>
      matchFrameInstances(
        [mobile, desktop],
        [reference("mobile", alpha), reference("desktop", "c".repeat(64))],
      ),
    { code: "missing-instance" },
  );
});
