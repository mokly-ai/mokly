import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  MockLink,
  mockLink,
  reviewMaterialKey,
  ReviewIgnore,
  ReviewIgnoreScope,
} from "@mokly/mokly";
import type { MockLinkProps } from "@mokly/mokly";

import { reviewMaterialKey as viewerMaterialKey } from "../packages/viewer/dist/data/material_key.js";

test("MockLink keeps fragments separate from paths and rendered props", () => {
  assert.throws(() => MockLink({ to: "details#summary", children: "Bad" }), {
    message: "link target must be a complete or relative catalogue path",
  });
  const html = renderToStaticMarkup(
    MockLink({
      to: "details",
      fragment: "summary",
      className: "details-link",
      children: "Details",
    }),
  );
  assert.equal(
    html,
    '<a class="details-link" href="mock:details#summary">Details</a>',
  );
  assert.doesNotMatch(html, /fragment=/);
});

test("authoring helpers reject untyped values before coercion or rendering", () => {
  let coerced = 0;
  const value = {
    [Symbol.toPrimitive]() {
      coerced++;
      return "target";
    },
  };
  assert.throws(
    () => mockLink(value as unknown as string),
    /path or a definition/,
  );
  assert.equal(coerced, 0);
  for (const path of [
    "mock:path",
    "path#anchor",
    "path%23anchor",
    "/absolute",
    "a//b",
  ])
    assert.throws(() => mockLink(path));
  assert.equal(mockLink("../path", "résumé-2"), "mock:../path#résumé-2");
  assert.equal(mockLink("com0"), "mock:com0");
  assert.equal(mockLink("./a/../b"), "mock:./a/../b");
  assert.throws(() => mockLink("mokly-generated/private"));
  assert.throws(
    () =>
      MockLink({
        to: "path",
        asChild: "yes",
        children: createElement("button"),
      } as unknown as MockLinkProps),
    /asChild must be boolean/,
  );
  assert.throws(() => ReviewIgnore({ id: "Bad ID" }), /kebab-case/);
  assert.throws(
    () => ReviewIgnoreScope({ enabled: "no" as unknown as boolean }),
    /boolean/,
  );
});

test("material keys match the viewer and retain negative zero and UTF-16 ordering", () => {
  const data = {
    "2": 1,
    "10": -0,
    "\ue000": true,
    "😀": null,
    nested: ["value", {}],
  };
  assert.equal(reviewMaterialKey(data), viewerMaterialKey(data));
  assert.notEqual(
    reviewMaterialKey({ value: -0 }),
    reviewMaterialKey({ value: 0 }),
  );
  for (const invalid of [
    { value: undefined },
    { value: Infinity },
    { value: () => null },
    { value: new Date() },
  ])
    assert.throws(() => reviewMaterialKey(invalid));
  let accessed = false;
  assert.throws(() =>
    reviewMaterialKey({
      get value() {
        accessed = true;
        return "bad";
      },
    }),
  );
  assert.equal(accessed, false);
});
