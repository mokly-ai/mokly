import assert from "node:assert/strict";
import { test } from "node:test";

import { Fragment, type ReactElement } from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import { createJsxDEV } from "../dist/build/jsx_dev_runtime.js";
import { defineComponent } from "../dist/index.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("dev shim forwards the consumer Fragment, keys and static/dynamic children through jsx/jsxs", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const jsxDEV = createJsxDEV(fixture.root, fixture.root);
  const location = {
    fileName: "entries/fixture.mockup.tsx",
    lineNumber: 2,
    columnNumber: 4,
  };
  const children = [
    jsx("span", { children: "First" }, "first"),
    jsx("span", { children: "Second" }, "second"),
  ];
  for (const type of [
    "div",
    Fragment,
    (props: { children?: unknown }) => String(props.children),
  ] as const)
    for (const staticChildren of [false, true]) {
      const props = { children, key: "prop-key" };
      const expected = (staticChildren ? jsxs : jsx)(
        type,
        props,
        "explicit-key",
      );
      const actual = jsxDEV(
        type,
        props,
        "explicit-key",
        staticChildren,
        location,
      );
      assert.equal(actual.type, expected.type);
      assert.equal(actual.key, expected.key);
      assert.deepEqual(actual.props, expected.props);
      assert.equal((actual.props as { children: unknown }).children, children);
      assert.ok(!Object.hasOwn(actual.props as object, "__moklySource"));
    }
  assert.equal(
    jsxDEV("div", { key: "prop-key" }, undefined, false).key,
    "prop-key",
  );
});

test("dev shim attaches source only to registered wrappers without mutating their authored props", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const { Component } = defineComponent({
    id: "action",
    title: "Action",
    description: "Action",
    route: "components/action.html",
    dependencies: [],
    relatedDocs: [],
    propSchema: {
      kind: "object",
      properties: { label: { schema: { kind: "string" } } },
    },
    render: (props) => props.label,
    variants: [
      { id: "default", title: "Default", props: { label: "Continue" } },
    ],
  });
  const jsxDEV = createJsxDEV(fixture.root, fixture.root);
  const props = Object.freeze({ label: "Continue" });
  const rendered = jsxDEV(Component, props, "react-key", false, {
    fileName: "entries/fixture.mockup.tsx",
    lineNumber: 7,
    columnNumber: 9,
  }) as ReactElement<Record<string, unknown>>;
  assert.equal(rendered.key, "react-key");
  assert.deepEqual(rendered.props.__moklySource, {
    path: "entries/fixture.mockup.tsx",
    line: 7,
    column: 9,
  });
  assert.deepEqual(props, { label: "Continue" });
  const unavailable = jsxDEV(Component, props, undefined, false);
  assert.ok(!Object.hasOwn(unavailable.props as object, "__moklySource"));
});
