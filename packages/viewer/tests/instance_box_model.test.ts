import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

import {
  boxModelReaderFixture,
  firstKey,
  secondKey,
  model,
} from "./instance_box_model_fixture.js";

test("the reader measures selection, readiness and usage revisions with geometry from its own session", async (t) => {
  const { reader, registry, selected, session, requests } =
    boxModelReaderFixture(t);
  selected.status = "loading";
  reader.select(selected, firstKey);
  assert.equal(requests.length, 0);
  selected.status = "ready";
  registry.changed();
  assert.deepEqual(
    requests.map(({ key }) => key),
    [firstKey],
  );
  requests[0]!.result.resolve(model);
  await setImmediate();
  assert.deepEqual(reader.read(selected, firstKey), {
    box: model.box,
    model,
    sizes: {
      width: 160,
      height: 41,
      padding: { top: 6, right: 12, bottom: 8, left: 14 },
      contentWidth: 130,
      contentHeight: 22,
    },
  });
  const sibling = session();
  registry.add(sibling);
  registry.emit(sibling, { type: "geometry" });
  registry.emit(selected, { type: "hover", key: firstKey, boxes: [] });
  assert.equal(requests.length, 1);
  registry.emit(selected, { type: "geometry" });
  assert.equal(requests.length, 2);
  requests[1]!.result.resolve(null);
  await setImmediate();
  selected.usageRevision += 1;
  registry.changed();
  assert.equal(requests.length, 3);
  requests[2]!.result.resolve(model);
  await setImmediate();
  reader.select(selected, undefined);
  assert.equal(reader.read(selected, undefined), undefined);
  reader.select(undefined, firstKey);
  assert.equal(reader.read(undefined, firstKey), undefined);
  reader.select(selected, "f".repeat(64));
  assert.equal(requests.length, 3);
  selected.usage = { status: "pending" };
  selected.usageRevision += 1;
  registry.changed();
  reader.select(selected, firstKey);
  assert.equal(requests.length, 3);
});

test("the reader discards a late result after the selected key changes", async (t) => {
  const { reader, selected, requests } = boxModelReaderFixture(t);
  reader.select(selected, firstKey);
  reader.select(selected, secondKey);
  assert.equal(reader.read(selected, secondKey), undefined);
  requests[0]!.result.resolve(model);
  await setImmediate();
  assert.equal(reader.read(selected, secondKey), undefined);
  assert.deepEqual(
    requests.map(({ key }) => key),
    [firstKey, secondKey],
  );
  requests[1]!.result.resolve(null);
  await setImmediate();
  assert.equal(reader.read(selected, secondKey), undefined);
});

test("the reader discards a late result after frame replacement or usage revision", async (t) => {
  const { reader, selected, registry, session, requests } =
    boxModelReaderFixture(t);
  reader.select(selected, firstKey);
  const replacement = session();
  registry.remove(selected);
  registry.add(replacement);
  reader.select(replacement, firstKey);
  requests[0]!.result.resolve(model);
  await setImmediate();
  assert.equal(reader.read(replacement, firstKey), undefined);
  assert.equal(requests.length, 2);
  replacement.usageRevision += 1;
  registry.changed();
  requests[1]!.result.resolve(model);
  await setImmediate();
  assert.equal(reader.read(replacement, firstKey), undefined);
  assert.equal(requests.length, 3);
  requests[2]!.result.resolve(model);
  await setImmediate();
  assert.deepEqual(reader.read(replacement, firstKey)?.model, model);
});

test("the reader keeps one request in flight and one trailing measurement", async (t) => {
  const { reader, selected, registry, requests } = boxModelReaderFixture(t);
  reader.select(selected, firstKey);
  requests[0]!.result.resolve(model);
  await setImmediate();
  assert.deepEqual(reader.read(selected, firstKey)?.model, model);
  for (let index = 0; index < 5; index++)
    registry.emit(selected, { type: "geometry" });
  assert.equal(requests.length, 2);
  assert.deepEqual(reader.read(selected, firstKey)?.model, model);
  const measured = { ...model, box: { ...model.box, width: 180.4 } };
  requests[1]!.result.resolve(measured);
  await setImmediate();
  assert.deepEqual(reader.read(selected, firstKey)?.model, measured);
  assert.equal(requests.length, 3);
  const trailing = { ...model, box: { ...model.box, width: 200.4 } };
  requests[2]!.result.resolve(trailing);
  await setImmediate();
  assert.deepEqual(reader.read(selected, firstKey)?.model, trailing);
  assert.equal(requests.length, 3);
});

test("an instance without a box model takes the smallest rectangle of its boxes", async (t) => {
  const boxes = [
    { x: 10, y: 30, width: 40, height: 10 },
    { x: 20, y: 20, width: 50, height: 5 },
  ];
  const { reader, selected } = boxModelReaderFixture(t, false, [
    { key: firstKey, ranges: [{ id: "r-0", boxes }] },
    {
      key: secondKey,
      ranges: [{ id: "r-1", boxes: [{ x: 0, y: 0, width: 5, height: 5 }] }],
    },
  ]);
  reader.select(selected, firstKey);
  await setImmediate();
  assert.deepEqual(reader.read(selected, firstKey), {
    box: { x: 10, y: 20, width: 60, height: 20 },
  });
});

test("the reader has no box model for an absent method, a null result or a rejection", async (t) => {
  const unsupported = boxModelReaderFixture(t, false);
  unsupported.reader.select(unsupported.selected, firstKey);
  assert.equal(unsupported.requests.length, 0);
  assert.equal(
    unsupported.reader.read(unsupported.selected, firstKey),
    undefined,
  );
  const { reader, selected, registry, requests } = boxModelReaderFixture(t);
  const errors: string[] = [];
  t.after(registry.subscribeEvents((_, event) => errors.push(event.type)));
  reader.select(selected, firstKey);
  requests[0]!.result.resolve(model);
  await setImmediate();
  assert.deepEqual(reader.read(selected, firstKey)?.model, model);
  registry.emit(selected, { type: "geometry" });
  assert.deepEqual(reader.read(selected, firstKey)?.model, model);
  requests[1]!.result.resolve(null);
  await setImmediate();
  assert.equal(reader.read(selected, firstKey), undefined);
  registry.emit(selected, { type: "geometry" });
  requests[2]!.result.resolve(model);
  await setImmediate();
  assert.deepEqual(reader.read(selected, firstKey)?.model, model);
  registry.emit(selected, { type: "geometry" });
  assert.deepEqual(reader.read(selected, firstKey)?.model, model);
  requests[3]!.result.reject(new Error("measurement unavailable"));
  await setImmediate();
  assert.equal(reader.read(selected, firstKey), undefined);
  assert.deepEqual(errors, ["geometry", "geometry", "geometry"]);
});
