import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { BrowserBar } from "../src/browser-bar/browser-bar.js";
import { BrowserFrame } from "../src/device-frame/device-frame.js";
import { CollapseIcon, CopyIcon, ExpandIcon } from "../src/icons/icons.js";

const COPY = renderToStaticMarkup(<CopyIcon />);
const GLYPHS = `<span aria-hidden="true" class="i-expand mbk-reset">${renderToStaticMarkup(<ExpandIcon />)}</span><span aria-hidden="true" class="i-collapse mbk-reset">${renderToStaticMarkup(<CollapseIcon />)}</span>`;

test("a static bar is a picture whose toggle names what it would do", () => {
  assert.equal(
    renderToStaticMarkup(
      <BrowserBar address="example.test/welcome" interactive={false} />,
    ),
    `<div class="browser-bar mbk-reset" data-browser-static=""><span class="lights mbk-reset"><i class="mbk-reset"></i><i class="mbk-reset"></i><i class="mbk-reset"></i></span><span class="address mbk-reset"><span class="address-url mbk-reset">example.test/welcome</span><span aria-hidden="true" class="address-copy mbk-reset">${COPY}</span></span><span aria-label="Expand to a wider viewport" class="browser-expand mbk-reset" role="img" title="Expand to a wider viewport">${GLYPHS}</span></div>`,
  );
  assert.equal(
    renderToStaticMarkup(
      <BrowserBar address="/a" expandable={false} interactive={false} />,
    ),
    `<div class="browser-bar mbk-reset" data-browser-static=""><span class="lights mbk-reset"><i class="mbk-reset"></i><i class="mbk-reset"></i><i class="mbk-reset"></i></span><span class="address mbk-reset"><span class="address-url mbk-reset">/a</span><span aria-hidden="true" class="address-copy mbk-reset">${COPY}</span></span></div>`,
  );
});

test("a static bar copies nothing and its toggle asks for nothing", () => {
  let copies = 0;
  const requests: boolean[] = [];
  const { container } = render(
    <BrowserBar
      address="/a"
      expanded
      interactive={false}
      onCopy={() => copies++}
      onExpandedChange={(expanded) => requests.push(expanded)}
    />,
  );
  assert.equal(screen.queryAllByRole("button").length, 0);
  const toggle = screen.getByRole("img", { name: "Collapse viewport" });
  fireEvent.click(toggle);
  const address = container.querySelector(".address");
  assert.ok(address instanceof HTMLElement);
  fireEvent.click(address);
  assert.equal(copies, 0);
  assert.deepEqual(requests, []);
  assert.equal(screen.queryAllByText("URL copied").length, 0);
});

test("a static browser window draws its bar as a picture", () => {
  const markup = renderToStaticMarkup(
    <BrowserFrame address="/a" interactive={false}>
      <p>Screen</p>
    </BrowserFrame>,
  );
  assert.match(
    markup,
    /^<div class="browser-frame mbk-reset"><div class="browser-bar mbk-reset" data-browser-static="">/u,
  );
  assert.match(
    markup,
    /<div class="browser-viewport mbk-reset"><p>Screen<\/p><\/div><\/div>$/u,
  );
  assert.doesNotMatch(markup, /<button/u);
});
