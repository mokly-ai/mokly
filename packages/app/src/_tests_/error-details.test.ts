import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ErrorDetails } from "../components/error-details";

// The app's Node loader emits classic JSX for files outside its workspace.
// Give that mockup the same React runtime for this isolated test file only.
const originalReact = Object.getOwnPropertyDescriptor(globalThis, "React");
before(() =>
  Object.defineProperty(globalThis, "React", {
    value: React,
    configurable: true,
  }),
);
after(() => {
  if (originalReact) Object.defineProperty(globalThis, "React", originalReact);
  else Reflect.deleteProperty(globalThis, "React");
});

const cases: readonly { name: string; reference?: string; details?: string }[] =
  [
    { name: "reference only", reference: "request-reference" },
    {
      name: "viewer diagnostics only",
      details: "Unsupported catalogue version 4",
    },
    {
      name: "reference and diagnostics",
      reference: "request-reference",
      details: "Unsupported catalogue version 4",
    },
    {
      name: "escaped diagnostics",
      reference: "<reference>",
      details: "<script>diagnostic & detail</script>",
    },
    { name: "absent values" },
    { name: "empty values", reference: "", details: "" },
  ];

for (const { name, ...props } of cases) {
  test(`the app and mockup Details match for ${name}`, async () => {
    const { ErrorDetails: MockupErrorDetails } =
      await import("../../../../docs/mockups/src/components/error-details");
    const app = renderToStaticMarkup(React.createElement(ErrorDetails, props));
    const mockup = renderToStaticMarkup(
      React.createElement(MockupErrorDetails, props),
    );
    assert.equal(app, mockup);
    const hasContent = Boolean(props.reference || props.details);
    assert.equal([...app.matchAll(/<details\b/g)].length, hasContent ? 1 : 0);
    assert.equal(
      [...app.matchAll(/<summary>Details<\/summary>/g)].length,
      hasContent ? 1 : 0,
    );
    assert.doesNotMatch(app, /<details[^>]*\bopen|<script/);
    if (props.details) assert.ok(app.includes('<p class="fo-note-detail">'));
    if (props.reference)
      assert.ok(app.includes('Reference <code class="mono-value">'));
  });
}
