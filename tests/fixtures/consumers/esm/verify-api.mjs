import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import * as api from "@mokly/mokly";

const expected = [
  "MockLink",
  "ReviewIgnore",
  "ReviewIgnoreScope",
  "collection",
  "defineCollection",
  "defineComponent",
  "defineConfig",
  "definePage",
  "defineRoot",
  "defineScreen",
  "defineUseCase",
  "mockLink",
  "page",
  "resolveInstance",
  "reviewMaterialKey",
  "screen",
];

assert.deepEqual(Object.keys(api).sort(), expected);
assert.equal(api.mockLink("packed-home"), "mock:packed-home");
assert.equal(
  api.mockLink("packed-home", "packed-section"),
  "mock:packed-home#packed-section",
);
assert.throws(() => api.mockLink("packed-home#packed-section"), /kebab-case/);

const instance = {
  key: createHash("sha256")
    .update(
      JSON.stringify(["mokabook-instance-v1", "entry", null, null, "action"]),
    )
    .digest("hex"),
  id: "action",
  componentId: "action",
  owner: { kind: "entry" },
  order: 0,
  props: {},
  propsKey: api.reviewMaterialKey({}),
};
assert.equal(api.resolveInstance(instance, instance), "present");
assert.equal(api.resolveInstance(instance, { ...instance, order: 1 }), "moved");
assert.equal(api.resolveInstance(instance, undefined), "missing");
