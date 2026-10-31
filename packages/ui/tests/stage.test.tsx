import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { Stage } from "../src/stage/stage.js";

test("a bare stage holds a state and records nothing", () => {
  assert.equal(
    renderToStaticMarkup(
      <Stage>
        <i>state</i>
      </Stage>,
    ),
    '<div class="mbk-stage"><i>state</i></div>',
  );
});

test("a stage of live frames keeps its scroll and records the shown viewport", () => {
  assert.equal(
    renderToStaticMarkup(<Stage kind="live" routed viewport="mobile" />),
    '<div class="mbk-stage mbk-live" data-mokly-scroll="stage" data-mokly-stage="" data-viewport="mobile"></div>',
  );
  // A previous version's stage is not the routed stage itself.
  assert.equal(
    renderToStaticMarkup(<Stage kind="live" viewport="both" />),
    '<div class="mbk-stage mbk-live" data-mokly-scroll="stage" data-viewport="both"></div>',
  );
});

test("a component's stage holds its canvases", () => {
  assert.equal(
    renderToStaticMarkup(<Stage kind="component" routed viewport="both" />),
    '<div class="mbk-stage mbk-component-stage" data-mokly-scroll="stage" data-mokly-stage="" data-viewport="both"></div>',
  );
});
