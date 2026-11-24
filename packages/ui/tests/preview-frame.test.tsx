import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, within } from "@testing-library/react";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PreviewIframe } from "../src/preview-frame/preview-frame.js";

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
    '<iframe aria-busy="true" class="mbk-frag mbk-reset" data-mokly-fragment-frame="" data-mokly-frame-state="loading" data-fragment-light="/a.html" data-fragment-dark="/a.dark.html" sandbox="allow-same-origin" src="/a.html" title="Home — mobile"></iframe>',
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
    '<iframe class="mbk-frag mbk-reset" data-mokly-comparison-frame="" data-mokly-preview-source="https://a.test/before.html" sandbox="allow-same-origin" scrolling="no" srcDoc="&lt;p&gt;before&lt;/p&gt;" title="Before — mobile — light"></iframe>',
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
