import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  MockLink,
  ReviewIgnore,
  ReviewIgnoreScope,
  reviewMaterialKey,
} from "../dist/index.js";
import { serializeReviewSentinels } from "../dist/renderer/sentinels.js";

test("ReviewIgnore serializes to inert paired comments", () => {
  const key = reviewMaterialKey({ current: "home" });
  const html = serializeReviewSentinels(
    renderToStaticMarkup(
      <ReviewIgnore id="shared-nav" materialKey={key}>
        <nav>Navigation</nav>
      </ReviewIgnore>,
    ),
  );
  assert.match(html, /<!--mokly-review-ignore:start:shared-nav-->/);
  assert.match(html, /<!--mokly-review-ignore:end:shared-nav-->/);
  assert.match(html, /<!--mokly-review-material:shared-nav:[a-f0-9]{64}-->/);
});

test("MockLink keeps fragment identity out of rendered package props", () => {
  const html = renderToStaticMarkup(
    <MockLink className="details-link" fragment="billing-section" to="details">
      Details
    </MockLink>,
  );

  assert.equal(
    html,
    '<a class="details-link" href="mock:details#billing-section">Details</a>',
  );
  assert.doesNotMatch(html, /fragment=/);
  assert.throws(
    () => renderToStaticMarkup(<MockLink to="details#billing">Bad</MockLink>),
    /expected a complete path/,
  );
});

test("ReviewIgnoreScope can render children with no marker contract", () => {
  const html = renderToStaticMarkup(
    <ReviewIgnoreScope enabled={false}>
      <ReviewIgnore id="shared-nav">
        <nav>Navigation</nav>
      </ReviewIgnore>
    </ReviewIgnoreScope>,
  );
  assert.equal(html, "<nav>Navigation</nav>");
});

test("review material keys reject cyclic or non-finite state", () => {
  const cyclic: { self?: object } = {};
  cyclic.self = cyclic;
  assert.throws(() => reviewMaterialKey(cyclic), /cyclic/);
  assert.throws(() => reviewMaterialKey({ value: Number.NaN }), /finite/);
});
