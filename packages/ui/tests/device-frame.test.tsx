import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { BrowserBar } from "../src/browser-bar/browser-bar.js";
import { BrowserFrame, PhoneFrame } from "../src/device-frame/device-frame.js";

test("the phone draws its notch, its status band, the screen content, and the home pill", () => {
  const markup = renderToStaticMarkup(
    <PhoneFrame>
      <i>screen</i>
    </PhoneFrame>,
  );
  assert.match(
    markup,
    /^<div class="phone-frame mbk-reset"><div class="phone-notch mbk-reset" aria-hidden="true"><\/div><div class="phone-screen mbk-reset"><div class="phone-status mbk-reset"><span class="mbk-reset">9:41<\/span><span class="phone-status-icons mbk-reset">(<svg aria-hidden="true"[^>]*>.*?<\/svg>){3}<\/span><\/div><i>screen<\/i><\/div><div class="phone-home mbk-reset" aria-hidden="true"><\/div><\/div>$/u,
  );
  assert.equal(markup.match(/<svg aria-hidden="true"/gu)?.length, 3);
});

test("the browser window draws its bar above the viewport that holds the preview", () => {
  const bar = renderToStaticMarkup(<BrowserBar address="/view/a/" />);
  assert.equal(
    renderToStaticMarkup(
      <BrowserFrame address="/view/a/">
        <i>page</i>
      </BrowserFrame>,
    ),
    `<div class="browser-frame mbk-reset">${bar}<div class="browser-viewport mbk-reset"><i>page</i></div></div>`,
  );
  assert.equal(
    renderToStaticMarkup(
      <BrowserFrame address="/a" expandable={false} expanded />,
    ),
    `<div class="browser-frame is-expanded mbk-reset">${renderToStaticMarkup(
      <BrowserBar address="/a" expandable={false} expanded />,
    )}<div class="browser-viewport mbk-reset"></div></div>`,
  );
});

test("an expanded window is marked, and its bar reports the host's callbacks", () => {
  const requests: boolean[] = [];
  let copies = 0;
  const { container } = render(
    <BrowserFrame
      address="/a"
      expanded
      onCopy={() => copies++}
      onExpandedChange={(expanded) => requests.push(expanded)}
    />,
  );
  assert.equal(
    container.querySelector(".browser-frame")?.className,
    "browser-frame is-expanded mbk-reset",
  );
  fireEvent.click(screen.getByRole("button", { name: "Collapse viewport" }));
  assert.deepEqual(requests, [false]);
  const address = container.querySelector(".address");
  assert.ok(address instanceof HTMLElement);
  fireEvent.click(address);
  assert.equal(copies, 1);
});
