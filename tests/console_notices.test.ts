import assert from "node:assert/strict";
import test from "node:test";

import { viewerSandboxNotice } from "./browser/console_notices.js";

const REASON =
  "because the document's frame is sandboxed and the 'allow-scripts' permission is not set.";
const blocked = (url: string) =>
  `Blocked script execution in '${url}' ${REASON}`;

test("a blocked script in a viewer-owned sandboxed frame is an expected notice", () => {
  for (const url of [
    "about:srcdoc",
    "http://127.0.0.1:4517/static/shop/cart/index.mobile.html",
    "http://127.0.0.1:4517/site/static/shop/cart/index.mobile.html",
    "https://catalogue.example/__mokly/components/renders/0123/index.html",
  ])
    assert.equal(viewerSandboxNotice(blocked(url), ""), true, url);
  assert.equal(
    viewerSandboxNotice(
      blocked("about:blank"),
      "http://127.0.0.1:4517/static/shop/cart/index.mobile.html",
    ),
    true,
    "Chrome locates the report in a stage frame",
  );
});

test("every other console error stays an error", () => {
  for (const [text, location] of [
    [blocked("http://127.0.0.1:4517/view/shop/cart/"), ""],
    [blocked("http://127.0.0.1:4517/statics/cart.html"), ""],
    [blocked("about:blank"), ""],
    [`Blocked script execution in 'about:srcdoc'`, "about:srcdoc"],
    ["Uncaught TypeError: x is not a function", "about:srcdoc"],
    [
      "Refused to execute inline script because it violates the following Content Security Policy directive",
      "http://127.0.0.1:4517/static/shop/cart/index.mobile.html",
    ],
  ] as const)
    assert.equal(viewerSandboxNotice(text, location), false, text);
});
