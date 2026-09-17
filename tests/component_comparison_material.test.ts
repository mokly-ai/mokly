import assert from "node:assert/strict";
import { test } from "node:test";

import {
  componentUsageSignals,
  stripComponentMarkers,
} from "../dist/components/comparison_material.js";
import { projectComponentPair } from "../dist/components/comparison_projection.js";
import type { ComponentViewRecord } from "../dist/components/manifest_types.js";

test("component marker stripping removes only current valid boundaries", () => {
  const html =
    "before<!--mokly-component:start:r-0--><span>inside</span>" +
    "<!--mokly-component:end:r-0-->after";

  assert.equal(stripComponentMarkers(html), "before<span>inside</span>after");
  assert.equal(
    stripComponentMarkers("<!--mokabook-component:start:r-0-->legacy"),
    "<!--mokabook-component:start:r-0-->legacy",
  );
  assert.equal(
    stripComponentMarkers("<!--mokly-component:start:not-a-range-->forged"),
    "<!--mokly-component:start:not-a-range-->forged",
  );
});

test("component usage signals retain input changes for identical documents", () => {
  const before = componentView("before");
  const after = componentView("after");
  const html = "<html><body><button>Same output</button></body></html>";

  assert.deepEqual(componentUsageSignals(before, after), {
    inputs: true,
    structure: false,
  });
  assert.deepEqual(
    {
      inputs: projectComponentPair(html, html, before, after, "view.html")
        .inputs,
      structure: projectComponentPair(html, html, before, after, "view.html")
        .structure,
    },
    { inputs: true, structure: false },
  );
});

function componentView(propsKey: string): ComponentViewRecord {
  return {
    viewport: "mobile",
    colorScheme: "light",
    instances: [
      {
        key: "action",
        id: "action",
        componentId: "action",
        owner: { kind: "entry" },
        order: 0,
        props: {},
        propsKey,
      },
    ],
    slots: [],
    ranges: [],
    styles: [],
    resources: [],
  };
}
