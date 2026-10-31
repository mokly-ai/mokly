import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ComparisonLayer,
  ComparisonPane,
  ComparisonSurface,
  ComparisonViewport,
  ComponentFrame,
} from "../src/comparison-pane/comparison-pane.js";

test("each pane is labelled with its version above its chrome", () => {
  assert.equal(
    renderToStaticMarkup(
      <ComparisonPane side="before">
        <i>chrome</i>
      </ComparisonPane>,
    ),
    '<div class="mb-pane mb-pane--before"><p class="mb-pane-label">Before</p><i>chrome</i></div>',
  );
  render(
    <>
      <ComparisonPane side="before" />
      <ComparisonPane side="after" />
    </>,
  );
  assert.ok(screen.getByText("Before", { exact: true }));
  assert.ok(screen.getByText("Current", { exact: true }));
});

test("a version without a document shows its message in place of the chrome", () => {
  assert.equal(
    renderToStaticMarkup(
      <ComparisonPane missing="This screen has been removed." side="after">
        <i>chrome</i>
      </ComparisonPane>,
    ),
    '<div class="mb-pane mb-pane--after"><p class="mb-pane-label">Current</p><p class="mb-pane-missing">This screen has been removed.</p></div>',
  );
});

test("a stacked layer has no label", () => {
  assert.equal(
    renderToStaticMarkup(
      <ComparisonLayer side="after">
        <i>document</i>
      </ComparisonLayer>,
    ),
    '<div class="mb-pane mb-pane--after"><i>document</i></div>',
  );
});

test("the viewport holds the versions in its sticky box before the range spacer", () => {
  assert.equal(
    renderToStaticMarkup(
      <ComparisonViewport>
        <i>layers</i>
      </ComparisonViewport>,
    ),
    '<div class="mb-viewport" data-comparison-viewport=""><div class="mb-viewport-box"><i>layers</i></div><div aria-hidden="true" class="mb-viewport-spacer" data-comparison-spacer=""></div></div>',
  );
});

test("the host's scroll controller receives the viewport, the spacer, and each surface", () => {
  const viewport = createRef<HTMLDivElement>();
  const spacer = createRef<HTMLDivElement>();
  const surface = createRef<HTMLDivElement>();
  render(
    <ComparisonViewport ref={viewport} spacerRef={spacer}>
      <ComparisonSurface ref={surface}>
        <i>frame</i>
      </ComparisonSurface>
    </ComparisonViewport>,
  );
  assert.ok(
    viewport.current?.matches(".mb-viewport[data-comparison-viewport]"),
  );
  assert.ok(
    spacer.current?.matches(".mb-viewport-spacer[data-comparison-spacer]"),
  );
  assert.equal(
    spacer.current?.previousElementSibling?.className,
    "mb-viewport-box",
  );
  assert.equal(surface.current?.className, "mb-pane-doc");
  assert.equal(surface.current?.parentElement?.className, "mb-viewport-box");
  assert.ok(screen.getByText("frame").parentElement === surface.current);
});

test("a saved component variant's frame is a bordered box", () => {
  assert.equal(
    renderToStaticMarkup(
      <ComponentFrame>
        <i />
      </ComponentFrame>,
    ),
    '<div class="mb-component-frame"><i></i></div>',
  );
});
