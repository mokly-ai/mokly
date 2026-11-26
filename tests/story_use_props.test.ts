import assert from "node:assert/strict";
import test from "node:test";

import { createElement, isValidElement } from "react";

import { copyData } from "../packages/mokly/src/authoring/data.js";
import { storyUseDataProps } from "../packages/mokly/src/sidecar/story-use-props.js";

const record = (props: Record<string, unknown>) =>
  storyUseDataProps(props, isValidElement);
const digestText = /^mokly:digest:[a-f0-9]{64}$/u;

test("story use props keep data and replace nested callbacks and elements", () => {
  const element = createElement("b", null, "icon");
  const onClick = () => "called";
  const props = {
    onClick,
    icon: element,
    children: [element, "Text"],
    items: [{ label: "Save", onClick, icon: element }, onClick, element],
    scalar: -0,
  };
  assert.deepEqual(record(props), {
    items: [
      { label: "Save", onClick: "mokly:function", icon: "mokly:element" },
      "mokly:function",
      "mokly:element",
    ],
    scalar: -0,
  });
  assert.deepEqual(props.items[0], { label: "Save", onClick, icon: element });
  assert.equal(props.items[1], onClick);
  assert.equal(props.items[2], element);
  assert.deepEqual(record({ children: ["Text", 2] }), {
    children: ["Text", 2],
  });
});

test("story use props follow JSON for undefined and array holes", () => {
  const sparse = Array<unknown>(2);
  sparse[1] = "present";
  assert.deepEqual(
    record({
      missing: undefined,
      object: { missing: undefined, kept: true },
      array: [undefined, null],
      sparse,
    }),
    { object: { kept: true }, array: [null, null], sparse: [null, "present"] },
  );
});

test("story use props record date and tagged non-JSON scalars", () => {
  assert.deepEqual(
    record({
      values: [
        new Date("2026-11-26T12:00:00Z"),
        NaN,
        Infinity,
        -Infinity,
        9007199254740993n,
      ],
    }),
    {
      values: [
        "2026-11-26T12:00:00.000Z",
        "mokly:number:NaN",
        "mokly:number:Infinity",
        "mokly:number:-Infinity",
        "mokly:bigint:9007199254740993",
      ],
    },
  );
  const invalid = record({ value: new Date(NaN) });
  assert.match(String(invalid.value), digestText);
  assert.deepEqual(invalid, record({ value: new Date(NaN) }));
  const symbol = record({ value: Symbol("label") });
  assert.match(String(symbol.value), digestText);
  assert.notDeepEqual(symbol, record({ value: Symbol("other") }));
});

test("story use props hash collection entries in their order", () => {
  const first = record({
    map: new Map([
      ["first", { label: "a" }],
      ["second", { label: "b" }],
    ]),
    set: new Set(["a", "b"]),
  });
  assert.match(String(first.map), digestText);
  assert.match(String(first.set), digestText);
  assert.deepEqual(
    first,
    record({
      map: new Map([
        ["first", { label: "a" }],
        ["second", { label: "b" }],
      ]),
      set: new Set(["a", "b"]),
    }),
  );
  assert.notEqual(
    first.map,
    record({
      map: new Map([
        ["first", { label: "edit" }],
        ["second", { label: "b" }],
      ]),
    }).map,
  );
  assert.notEqual(first.set, record({ set: new Set(["b", "a"]) }).set);
  assert.notEqual(
    first.map,
    record({
      map: new Map([
        ["second", { label: "b" }],
        ["first", { label: "a" }],
      ]),
    }).map,
  );
});

test("story use props hash class names, enumerable fields, and cycle references", () => {
  class Item {
    constructor(readonly label: string) {}
  }
  class Other {
    constructor(readonly label: string) {}
  }
  const cycle = (label: string, atRoot: boolean, reverse = false) => {
    const root: Record<string, unknown> = {};
    const child: Record<string, unknown> = {
      parent: atRoot ? root : undefined,
    };
    if (!atRoot) child.parent = child;
    Object.assign(root, reverse ? { label, child } : { child, label });
    return root;
  };
  const { values } = record({
    values: [
      Object.assign(new Map(), { label: "a" }),
      Object.assign(new Map(), { label: "b" }),
      Object.assign(new Set(), { label: "a" }),
      new Item("a"),
      new Item("b"),
      new Other("a"),
    ],
  });
  assert.ok(Array.isArray(values));
  for (const value of values) assert.match(String(value), digestText);
  assert.equal(new Set(values).size, 6);
  const first = record({ value: cycle("a", true) });
  assert.match(String(first.value), digestText);
  assert.deepEqual(first, record({ value: cycle("a", true, true) }));
  assert.notDeepEqual(first, record({ value: cycle("b", true) }));
  const childCycle = cycle("a", false);
  const recorded = record({ value: childCycle });
  assert.notDeepEqual(first, recorded);
  assert.ok(
    recorded.value &&
      typeof recorded.value === "object" &&
      "child" in recorded.value,
  );
  assert.deepEqual(recorded.value, { label: "a", child: recorded.value.child });
  assert.match(String(recorded.value.child), digestText);
});

test("story use props hash reserved object keys and preserve other props", () => {
  for (const key of ["__proto__", "constructor", "prototype"]) {
    const input = { [key]: "value", label: "kept in the digest" };
    const first = record({ input, label: "unchanged" });
    assert.match(String(first.input), digestText, key);
    assert.equal(first.label, "unchanged");
    assert.doesNotThrow(() => copyData(first), key);
    assert.notEqual(
      first.input,
      record({ input: { ...input, [key]: "edit" } }).input,
    );
  }
});

test("story use props hash data beyond either copy bound", () => {
  const deep = (last: string) => {
    let value: unknown = last;
    for (let depth = 0; depth < 15_000; depth++) value = { value };
    return value;
  };
  const wide = (last: string) => [...Array<string>(9_998).fill("item"), last];
  const first = record({ deep: deep("one"), wide: wide("one") });
  assert.doesNotThrow(() => copyData(first));
  assert.match(String(first.deep), digestText);
  assert.match(String(first.wide), digestText);
  assert.deepEqual(first, record({ deep: deep("one"), wide: wide("one") }));
  assert.notDeepEqual(first.deep, record({ deep: deep("two") }).deep);
  assert.notDeepEqual(first.wide, record({ wide: wide("two") }).wide);

  const data = Array<string>(6_000).fill("first");
  const aggregate = record({ a: data, b: data, z: "kept" });
  assert.doesNotThrow(() => copyData(aggregate));
  assert.deepEqual(aggregate.a, data);
  assert.match(String(aggregate.b), digestText);
  assert.equal(aggregate.z, "kept");
  assert.deepEqual(aggregate, record({ z: "kept", b: data, a: data }));
});
