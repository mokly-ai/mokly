import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { renderToString } from "react-dom/server";

import {
  HighlightLabel,
  LabelLayer,
} from "../src/highlight-label/highlight-label.js";

import { assertSameElement } from "./dom-assertions.js";

test("a label layer takes its place inline only when the host names one", () => {
  assert.equal(
    renderToString(<LabelLayer />),
    '<div data-mokly-label-layer=""></div>',
  );
  assert.equal(
    renderToString(<LabelLayer placement="root" />),
    '<div data-mokly-label-layer="" style="position:absolute;inset:0;pointer-events:none"></div>',
  );
  assert.equal(
    renderToString(<LabelLayer placement="viewport" />),
    '<div data-mokly-label-layer="" style="inset:0;overflow:hidden;pointer-events:none;position:fixed;z-index:952"></div>',
  );
});

test("the layer holds its labels and hands its element to the host", () => {
  const layer = createRef<HTMLDivElement>();
  const { container } = render(
    <LabelLayer placement="root" ref={layer}>
      <HighlightLabel left={4} onSelect={() => undefined} text="A" top={8} />
    </LabelLayer>,
  );
  assertSameElement(layer.current, container.firstElementChild);
  assertSameElement(
    screen.getByRole("button", { name: "A" }).parentElement,
    layer.current,
  );
});

test("a workspace label names its instance and sits where the host measured it", () => {
  assert.equal(
    renderToString(
      <HighlightLabel
        instanceKey="a"
        left={12.5}
        onSelect={() => undefined}
        text="Button · primary"
        top={0}
      />,
    ),
    '<button class="mbk-highlight-label" data-instance-key="a" style="left:12.5px;top:0" type="button">Button · primary</button>',
  );
});

test("a host inspection's label names its label and states its pointer events", () => {
  assert.equal(
    renderToString(
      <HighlightLabel
        labelKey='[1,"b"]'
        left={0}
        onSelect={() => undefined}
        pointerEvents="auto"
        text="Card · <b>"
        top={40}
      />,
    ),
    '<button class="mbk-highlight-label" data-mokly-label-key="[1,&quot;b&quot;]" style="left:0;pointer-events:auto;top:40px" type="button">Card · &lt;b&gt;</button>',
  );
});

test("each press of a label selects its instance", () => {
  let presses = 0;
  render(
    <HighlightLabel
      instanceKey="a"
      left={0}
      onSelect={() => {
        presses += 1;
      }}
      text="Button · primary"
      top={0}
    />,
  );
  const label = screen.getByRole("button", { name: "Button · primary" });
  fireEvent.click(label);
  fireEvent.click(label);
  assert.equal(presses, 2);
});
