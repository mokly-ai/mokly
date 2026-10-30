import "./dom.js";

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";

import { render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DocumentFrame,
  PreviewFrame,
  PreviewIframe,
} from "../src/preview-frame/preview-frame.js";

const UNAVAILABLE = '<p class="mbk-empty">This preview is unavailable.</p>';
const ERROR =
  '<p class="mbk-frame-error" role="status">This preview could not be loaded.</p>';

test("a frame on a stage names its viewport above its content", () => {
  assert.equal(
    renderToStaticMarkup(
      <PreviewFrame
        placement={{ kind: "frame", viewport: "mobile" }}
        scheme="dark"
      >
        <i>phone</i>
      </PreviewFrame>,
    ),
    '<div class="mbk-frame-wrap mbk-frame-mobile" data-preview-color-scheme="dark"><p class="mbk-frame-label">Mobile</p><i>phone</i></div>',
  );
  assert.equal(
    renderToStaticMarkup(
      <PreviewFrame
        fallback
        placement={{ kind: "canvas", viewport: "desktop" }}
        scheme="light"
      >
        <i>canvas</i>
      </PreviewFrame>,
    ),
    '<div class="mbk-component-canvas mbk-frame-desktop" data-color-scheme-fallback="" data-preview-color-scheme="light"><p class="mbk-frame-label">Desktop<span class="mbk-frame-scheme-note"> — Light only</span></p><i>canvas</i></div>',
  );
});

test("a flow screen and a comparison pane's chrome have no label", () => {
  assert.equal(
    renderToStaticMarkup(
      <PreviewFrame fallback placement={{ kind: "flow" }} scheme="light">
        <i />
      </PreviewFrame>,
    ),
    '<div class="mbk-flow-screen" data-color-scheme-fallback="" data-preview-color-scheme="light"><i></i></div>',
  );
  assert.equal(
    renderToStaticMarkup(
      <PreviewFrame placement={{ kind: "pane" }} scheme="dark">
        <i />
      </PreviewFrame>,
    ),
    '<div class="mb-pane-chrome mbk-frame-wrap" data-preview-color-scheme="dark"><i></i></div>',
  );
});

test("a frame without content is unavailable, and a failed load adds its status", () => {
  assert.equal(
    renderToStaticMarkup(
      <PreviewFrame
        error
        placement={{ kind: "canvas", viewport: "mobile" }}
        scheme="light"
      />,
    ),
    `<div class="mbk-component-canvas mbk-frame-mobile" data-preview-color-scheme="light"><p class="mbk-frame-label">Mobile</p>${UNAVAILABLE}${ERROR}</div>`,
  );
  render(
    <PreviewFrame error placement={{ kind: "flow" }} scheme="light">
      <i>frame</i>
    </PreviewFrame>,
  );
  assert.equal(
    screen.getByRole("status").textContent,
    "This preview could not be loaded.",
  );
  assert.equal(screen.queryAllByText("This preview is unavailable.").length, 0);
});

test("a whole document fills the stage, which keeps its scroll as embed", () => {
  assert.equal(
    renderToStaticMarkup(
      <DocumentFrame scheme="dark">
        <i>document</i>
      </DocumentFrame>,
    ),
    '<div class="mbk-stage-embed" data-mokly-scroll="embed" data-preview-color-scheme="dark"><i>document</i></div>',
  );
  assert.equal(
    renderToStaticMarkup(<DocumentFrame error scheme="light" />),
    `<div class="mbk-stage-embed" data-mokly-scroll="embed" data-preview-color-scheme="light">${UNAVAILABLE}${ERROR}</div>`,
  );
});

test("a live frame keeps its attributes in order and is sandboxed without scripts", () => {
  assert.equal(
    renderToStaticMarkup(
      <PreviewIframe
        busy
        data={{
          "data-mokly-fragment-frame": "",
          "data-mokly-frame-state": "loading",
          "data-workspace-frame": undefined,
          "data-fragment-light": "/a.html",
          "data-fragment-dark": "/a.dark.html",
        }}
        src="/a.html"
        title="Home — mobile"
      />,
    ),
    '<iframe aria-busy="true" class="mbk-frag" data-mokly-fragment-frame="" data-mokly-frame-state="loading" data-fragment-light="/a.html" data-fragment-dark="/a.dark.html" sandbox="allow-same-origin" src="/a.html" title="Home — mobile"></iframe>',
  );
});

test("a comparison's snapshot frame takes its document inline and does not scroll", () => {
  assert.equal(
    renderToStaticMarkup(
      <PreviewIframe
        data={{
          "data-mokly-comparison-frame": "",
          "data-mokly-preview-source": "https://a.test/before.html",
        }}
        scrollable={false}
        srcDoc="<p>before</p>"
        title="Before — mobile — light"
      />,
    ),
    '<iframe class="mbk-frag" data-mokly-comparison-frame="" data-mokly-preview-source="https://a.test/before.html" sandbox="allow-same-origin" scrolling="no" srcDoc="&lt;p&gt;before&lt;/p&gt;" title="Before — mobile — light"></iframe>',
  );
});

test("the frame's element reaches the host's ref, named by its title", () => {
  const frame = createRef<HTMLIFrameElement>();
  // A container outside the document, so that happy-dom loads no frame.
  const { container } = render(<PreviewIframe ref={frame} title="Guide" />, {
    container: document.createElement("div"),
  });
  assert.ok(frame.current instanceof HTMLIFrameElement);
  assert.ok(within(container).getByTitle("Guide") === frame.current);
  assert.equal(frame.current.getAttribute("sandbox"), "allow-same-origin");
  assert.equal(frame.current.hasAttribute("aria-busy"), false);
});

/** A package stylesheet with its comments removed and its spaces folded. */
async function stylesheet(name: string): Promise<string> {
  const css = await fs.readFile(
    new URL(`../src/${name}/${name}.css`, import.meta.url),
    "utf8",
  );
  return css
    .replace(/\/\*[^]*?\*\//gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

// A light-only view under Dark keeps its light frame and names that fallback
// in its frame label. Screen frames and component canvases both carry the
// fallback mark, so the stylesheet must reveal the note in both.
test("the stylesheet names a light-only frame's fallback only under Dark", async () => {
  const note = await stylesheet("scheme-fallback");
  assert.ok(note.startsWith(".mbk-frame-scheme-note { display: none;"), note);
  const css = await stylesheet("preview-frame");
  const dark = 'body[data-mokly-color-scheme="dark"]';
  for (const frame of [".mbk-frame-wrap", ".mbk-component-canvas"])
    assert.ok(
      css.includes(
        `${dark} ${frame}[data-color-scheme-fallback] .mbk-frame-scheme-note`,
      ),
      frame,
    );
  // The note's own rule comes first in the package stylesheet, so the rules
  // that reveal it follow it.
  const order = await fs.readFile(
    new URL("../src/styles.css", import.meta.url),
    "utf8",
  );
  assert.ok(
    order.indexOf("scheme-fallback.css") < order.indexOf("preview-frame.css"),
  );
});
