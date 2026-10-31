import "./dom.js";

import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { BrowserBar } from "../src/browser-bar/browser-bar.js";
import { CollapseIcon, CopyIcon, ExpandIcon } from "../src/icons/icons.js";

const COPY = renderToStaticMarkup(<CopyIcon />);
const EXPAND = renderToStaticMarkup(<ExpandIcon />);
const COLLAPSE = renderToStaticMarkup(<CollapseIcon />);

/** The address pill of a rendered bar. */
function addressPill(container: HTMLElement): HTMLElement {
  const address = container.querySelector(".address");
  assert.ok(address instanceof HTMLElement);
  return address;
}

test("the bar draws its lights, its address, and the toggle that it offers", () => {
  assert.equal(
    renderToStaticMarkup(<BrowserBar address="/view/a/" />),
    `<div class="browser-bar"><span class="lights"><i></i><i></i><i></i></span><span class="address"><span class="address-url">/view/a/</span><span aria-hidden="true" class="address-copy">${COPY}</span></span><button aria-expanded="false" aria-label="Expand to a wider viewport" class="browser-expand" title="Expand to a wider viewport" type="button"><span aria-hidden="true" class="i-expand">${EXPAND}</span><span aria-hidden="true" class="i-collapse">${COLLAPSE}</span></button></div>`,
  );
  assert.equal(
    renderToStaticMarkup(<BrowserBar address="/a" expandable={false} />),
    `<div class="browser-bar"><span class="lights"><i></i><i></i><i></i></span><span class="address"><span class="address-url">/a</span><span aria-hidden="true" class="address-copy">${COPY}</span></span></div>`,
  );
});

test("the toggle asks to expand and to collapse the window", () => {
  const requests: boolean[] = [];
  const { rerender } = render(
    <BrowserBar
      address="/a"
      onExpandedChange={(expanded) => requests.push(expanded)}
    />,
  );
  const expand = screen.getByRole("button", {
    name: "Expand to a wider viewport",
  });
  assert.equal(expand.getAttribute("aria-expanded"), "false");
  assert.equal(expand.title, "Expand to a wider viewport");
  fireEvent.click(expand);
  assert.deepEqual(requests, [true]);

  rerender(
    <BrowserBar
      address="/a"
      expanded
      onExpandedChange={(expanded) => requests.push(expanded)}
    />,
  );
  const collapse = screen.getByRole("button", { name: "Collapse viewport" });
  assert.ok(collapse === expand);
  assert.equal(collapse.getAttribute("aria-expanded"), "true");
  assert.equal(collapse.title, "Collapse viewport");
  fireEvent.click(collapse);
  assert.deepEqual(requests, [true, false]);
});

test("a bar without the toggle offers neither expand nor collapse", () => {
  render(<BrowserBar address="/a" expandable={false} expanded />);
  assert.equal(screen.queryAllByRole("button").length, 0);
});

test("a press on the address asks to copy it and shows URL copied for 1400 ms", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let copies = 0;
  const { container } = render(
    <BrowserBar address="/view/a/" onCopy={() => copies++} />,
  );
  const address = addressPill(container);
  assert.equal(screen.queryAllByText("URL copied").length, 0);
  fireEvent.click(address);
  assert.equal(copies, 1);
  assert.equal(screen.getByText("URL copied").className, "address-copied");
  // The message precedes the toggle in the bar.
  assert.equal(
    screen.getByText("URL copied").nextElementSibling?.className,
    "browser-expand",
  );
  // A second press while the message shows copies again and keeps the
  // first message's end.
  act(() => context.mock.timers.tick(1000));
  fireEvent.click(address);
  assert.equal(copies, 2);
  act(() => context.mock.timers.tick(399));
  assert.equal(screen.getByText("URL copied").className, "address-copied");
  act(() => context.mock.timers.tick(1));
  assert.equal(screen.queryAllByText("URL copied").length, 0);
});

test("without a copy callback the address still shows the message", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const { container, unmount } = render(<BrowserBar address="/a" />);
    fireEvent.click(addressPill(container));
    assert.equal(screen.getByText("URL copied").className, "address-copied");
    // Unmounting clears the pending timer, so nothing updates afterwards.
    unmount();
    mock.timers.tick(1400);
  } finally {
    mock.timers.reset();
  }
});
