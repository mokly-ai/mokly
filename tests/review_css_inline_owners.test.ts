import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeInline,
  changedStyle,
  html,
  instance,
  key,
  markedRange,
  oneAttribution,
  range,
  resolved,
  slot,
  view,
} from "./helpers/inline_styles.js";

test("inline rules can be owned by one or two paired components", () => {
  for (const count of [1, 2]) {
    const instances = Array.from({ length: count }, (_, index) =>
      instance(index + 1, `component-${index + 1}`),
    );
    const ranges = instances.map((item, index) =>
      range(index, { kind: "instance", instanceKey: item.key }),
    );
    const body = instances
      .map((_, index) => markedRange(index, '<div class="target"></div>'))
      .join("");
    const usage = view({ instances, ranges });
    const styles = changedStyle();
    const result = resolved(
      analyzeInline({
        before: html(styles.before, body),
        after: html(styles.after, body),
        beforeUsage: usage,
        afterUsage: usage,
      }).result,
    );
    assert.deepEqual(result.rules[0]?.attribution, {
      kind: "owned",
      componentIds: instances.map(({ componentId }) => componentId),
    });
    assert.deepEqual(
      [...result.ownedComponentIds],
      instances.map(({ componentId }) => componentId),
    );
  }
});

test("an entry match on either side keeps the inline rule with the entry", () => {
  const item = instance(1, "component");
  const usage = view({
    instances: [item],
    ranges: [range(0, { kind: "instance", instanceKey: item.key })],
  });
  const styles = changedStyle();
  assert.deepEqual(
    oneAttribution(
      analyzeInline({
        before: html(styles.before, markedRange(0, '<div class="target"/>')),
        after: html(
          styles.after,
          `${markedRange(0, "<div/>")}<div class="target"></div>`,
        ),
        beforeUsage: usage,
        afterUsage: usage,
      }).result,
    ),
    { kind: "entry" },
  );
});

test("an unpaired matched instance resolves to the entry", () => {
  const beforeInstance = instance(1, "component");
  const afterInstance = instance(2, "component");
  const beforeUsage = view({
    instances: [beforeInstance],
    ranges: [range(0, { kind: "instance", instanceKey: beforeInstance.key })],
  });
  const afterUsage = view({
    instances: [afterInstance],
    ranges: [range(0, { kind: "instance", instanceKey: afterInstance.key })],
  });
  const styles = changedStyle();
  assert.deepEqual(
    oneAttribution(
      analyzeInline({
        before: html(styles.before, markedRange(0, '<div class="target"/>')),
        after: html(styles.after, markedRange(0, '<div class="target"/>')),
        beforeUsage,
        afterUsage,
      }).result,
    ),
    { kind: "entry" },
  );
});

test("changed props resolve to the entry or the paired parent input owner", () => {
  const beforeEntryChild = instance(2, "child", { propsKey: key(20) });
  const afterEntryChild = instance(2, "child", { propsKey: key(21) });
  const entryRange = [
    range(0, { kind: "instance", instanceKey: beforeEntryChild.key }),
  ];
  const styles = changedStyle();
  assert.deepEqual(
    oneAttribution(
      analyzeInline({
        before: html(styles.before, markedRange(0, '<div class="target"/>')),
        after: html(styles.after, markedRange(0, '<div class="target"/>')),
        beforeUsage: view({
          instances: [beforeEntryChild],
          ranges: entryRange,
        }),
        afterUsage: view({ instances: [afterEntryChild], ranges: entryRange }),
      }).result,
    ),
    { kind: "entry" },
  );

  const parent = instance(1, "parent");
  const owner = { kind: "instance" as const, instanceKey: parent.key };
  const beforeChild = instance(2, "child", { owner, propsKey: key(30) });
  const afterChild = instance(2, "child", { owner, propsKey: key(31) });
  const nestedRanges = [
    range(0, { kind: "instance", instanceKey: parent.key }),
    range(1, { kind: "instance", instanceKey: beforeChild.key }, 0),
  ];
  const body = markedRange(0, markedRange(1, '<div class="target"></div>'));
  assert.deepEqual(
    oneAttribution(
      analyzeInline({
        before: html(styles.before, body),
        after: html(styles.after, body),
        beforeUsage: view({
          instances: [parent, beforeChild],
          ranges: nestedRanges,
        }),
        afterUsage: view({
          instances: [parent, afterChild],
          ranges: nestedRanges,
        }),
      }).result,
    ),
    { kind: "owned", componentIds: ["parent"] },
  );
});

test("input-owner recursion fails closed on a cycle", () => {
  const owner = { kind: "instance" as const, instanceKey: key(1) };
  const beforeInstance = instance(1, "component", {
    owner,
    propsKey: key(20),
  });
  const afterInstance = instance(1, "component", {
    owner,
    propsKey: key(21),
  });
  const ranges = [
    range(0, { kind: "instance", instanceKey: beforeInstance.key }),
  ];
  const styles = changedStyle();
  assert.deepEqual(
    oneAttribution(
      analyzeInline({
        before: html(styles.before, markedRange(0, '<div class="target"/>')),
        after: html(styles.after, markedRange(0, '<div class="target"/>')),
        beforeUsage: view({ instances: [beforeInstance], ranges }),
        afterUsage: view({ instances: [afterInstance], ranges }),
      }).result,
    ),
    { kind: "entry" },
  );
});

test("root components and entry-owned slots resolve to the entry", () => {
  const root = instance(1, "root");
  const receiver = instance(2, "receiver");
  const entrySlot = slot(10, receiver, { kind: "entry" });
  const styles = changedStyle();
  for (const fixture of [
    {
      body: markedRange(0, '<div class="target"/>'),
      rootComponentId: "root",
      usage: view({
        instances: [root],
        ranges: [range(0, { kind: "instance", instanceKey: root.key })],
      }),
    },
    {
      body: markedRange(0, markedRange(1, '<div class="target"/>')),
      usage: view({
        instances: [receiver],
        slots: [entrySlot],
        ranges: [
          range(0, { kind: "instance", instanceKey: receiver.key }),
          range(1, { kind: "slot", slotKey: entrySlot.key }, 0),
        ],
      }),
    },
  ])
    assert.deepEqual(
      oneAttribution(
        analyzeInline({
          before: html(styles.before, fixture.body),
          after: html(styles.after, fixture.body),
          beforeUsage: fixture.usage,
          afterUsage: fixture.usage,
          ...(fixture.rootComponentId
            ? { rootComponentId: fixture.rootComponentId }
            : {}),
        }).result,
      ),
      { kind: "entry" },
    );
});

test("a slot supplied by a nested paired instance resolves to that component", () => {
  const parent = instance(1, "parent");
  const receiver = instance(2, "receiver", {
    owner: { kind: "instance", instanceKey: parent.key },
  });
  const supplied = slot(10, receiver, {
    kind: "instance",
    instanceKey: parent.key,
  });
  const ranges = [
    range(0, { kind: "instance", instanceKey: parent.key }),
    range(1, { kind: "instance", instanceKey: receiver.key }, 0),
    range(2, { kind: "slot", slotKey: supplied.key }, 1),
  ];
  const body = markedRange(
    0,
    markedRange(1, markedRange(2, '<span class="target"></span>')),
  );
  const usage = view({
    instances: [parent, receiver],
    slots: [supplied],
    ranges,
  });
  const styles = changedStyle();
  assert.deepEqual(
    oneAttribution(
      analyzeInline({
        before: html(styles.before, body),
        after: html(styles.after, body),
        beforeUsage: usage,
        afterUsage: usage,
      }).result,
    ),
    { kind: "owned", componentIds: ["parent"] },
  );
});
