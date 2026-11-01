import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";

import {
  DetailsBody,
  DetailsPanel,
} from "../src/details-panel/details-panel.js";
import { ChevronIcon } from "../src/icons/icons.js";

const BAR = `<summary class="mbk-details-bar mbk-reset"><span class="chev mbk-reset">${renderToStaticMarkup(<ChevronIcon size={12} />)}</span>Details<span class="mbk-details-hint mbk-reset">Description, rationale, source, related docs, and use cases</span></summary>`;

test("the panel draws its bar, then its content, and is open as the host says", () => {
  assert.equal(
    renderToStaticMarkup(
      <DetailsPanel open={false}>
        <p>Body</p>
      </DetailsPanel>,
    ),
    `<details class="mbk-details mbk-reset" data-mokly-details="">${BAR}<p>Body</p></details>`,
  );
  assert.equal(
    renderToStaticMarkup(<DetailsPanel open />),
    `<details class="mbk-details mbk-reset" data-mokly-details="" open="">${BAR}</details>`,
  );
});

test("the bar reports a native toggle that differs from the shown state", () => {
  const choices: boolean[] = [];
  const onOpenChange = (open: boolean) => choices.push(open);
  const { container, rerender } = render(
    <DetailsPanel onOpenChange={onOpenChange} open={false}>
      <p>Body</p>
    </DetailsPanel>,
  );
  const details = container.querySelector("details");
  assert.ok(details);
  // A toggle that agrees with the shown state reports nothing.
  fireEvent(details, new Event("toggle"));
  assert.deepEqual(choices, []);
  // happy-dom fires the toggle event as soon as `open` changes.
  details.open = true;
  assert.deepEqual(choices, [true]);
  rerender(
    <DetailsPanel onOpenChange={onOpenChange} open>
      <p>Body</p>
    </DetailsPanel>,
  );
  details.open = false;
  assert.deepEqual(choices, [true, false]);
});

test("without a callback the panel opens natively and reports nothing", () => {
  const { container } = render(<DetailsPanel open={false} />);
  const details = container.querySelector("details");
  assert.ok(details);
  details.open = true;
  assert.equal(details.open, true);
  assert.equal(screen.getByText("Details").tagName, "SUMMARY");
});

test("the body keeps the description, the rationale's four text nodes, and the metadata column", () => {
  const markup = renderToString(
    <DetailsBody
      description="The home screen."
      rationale={{ noun: "flow", text: "It shows the tour." }}
    >
      <div data-row="" />
    </DetailsBody>,
  );
  assert.equal(
    markup,
    '<div class="mbk-details-body mbk-reset"><div class="mbk-reset"><p class="mbk-details-desc mbk-reset">The home screen.</p><p class="mbk-details-rationale mbk-reset"><span class="k mbk-reset">Why this <!-- -->flow<!-- --> —<!-- --> </span>It shows the tour.</p></div><div class="mbk-meta mbk-reset"><div data-row=""></div></div></div>',
  );
});

test("a body without a rationale has no rationale paragraph and keeps an empty column", () => {
  assert.equal(
    renderToStaticMarkup(<DetailsBody description="" />),
    '<div class="mbk-details-body mbk-reset"><div class="mbk-reset"><p class="mbk-details-desc mbk-reset"></p></div><div class="mbk-meta mbk-reset"></div></div>',
  );
});
