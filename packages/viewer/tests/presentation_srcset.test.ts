import assert from "node:assert/strict";
import { test } from "node:test";

import { rewriteSrcset } from "../src/previews/presentation_url.js";

test("srcset rewrites only candidate URLs and preserves their commas and descriptors", () => {
  const srcset =
    " \t one.png 1x,  two,part.png   2x,\n" +
    ", three.png,,\r\n data:image/png;base64,AAAA 3x, wide.png 320w, " +
    "other.png future(a,b) 2x, /root.png 4x ";
  assert.equal(
    rewriteSrcset(srcset, "https://catalogue.test/archive/docs/index.html"),
    " \t https://catalogue.test/archive/docs/one.png 1x,  " +
      "https://catalogue.test/archive/docs/two,part.png   2x,\n" +
      ", https://catalogue.test/archive/docs/three.png,,\r\n " +
      "data:image/png;base64,AAAA 3x, https://catalogue.test/archive/docs/wide.png 320w, " +
      "https://catalogue.test/archive/docs/other.png future(a,b) 2x, " +
      "https://catalogue.test/root.png 4x ",
  );
});
