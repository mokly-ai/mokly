import assert from "node:assert/strict";
import test from "node:test";

import { restoreModuleImageSetUrls } from "../dist/build/styles/image_set_restore.js";

const cases = [
  [
    'a{background:image-set("./one.png" 1x, "./two.png?v=2#hash" 2x)}',
    'a{background:image-set(url("./one.png") 1x, url("./two.png?v=2#hash") 2x)}',
  ],
  [
    'a{background:IMAGE-SET("./one.avif" 1x type("image/avif"), "https://cdn.test/remote.png" 2x)}',
    'a{background:IMAGE-SET(url("./one.avif") 1x type("image/avif"), "https://cdn.test/remote.png" 2x)}',
  ],
  [
    'a{background:image-set(linear-gradient(red, blue) 1x, /* between */ "./second.png" 2x, "data:image/png;base64,AA" 3x)}',
    'a{background:image-set(linear-gradient(red, blue) 1x, /* between */ url("./second.png") 2x, "data:image/png;base64,AA" 3x)}',
  ],
  [
    'a{background:-webkit-image-set("./webkit.png" 1x);cursor:image-set("./cursor.png" 1x);content:image-set("./content.png" 1x)}',
    'a{background:-webkit-image-set("./webkit.png" 1x);cursor:image-set(url("./cursor.png") 1x);content:image-set(url("./content.png") 1x)}',
  ],
  [
    'a{background:image-set("./q\\"uote.png" 1x, "//cdn.test/remote.png" 2x);--set:image-set("./custom.png" 1x)}',
    'a{background:image-set(url("./q\\"uote.png") 1x, "//cdn.test/remote.png" 2x);--set:image-set(url("./custom.png") 1x)}',
  ],
  [
    'a{background:image-set(image-set("./nested.png" 1x) 1x, url("./existing.png") 2x)}',
    'a{background:image-set(image-set(url("./nested.png") 1x) 1x, url("./existing.png") 2x)}',
  ],
  [
    '.x{background-image:image-set("./background.png" 1x);border-image-source:image-set("./border.png" 1x);list-style-image:image-set("./list.png" 1x)}',
    '.x{background-image:image-set(url("./background.png") 1x);border-image-source:image-set(url("./border.png") 1x);list-style-image:image-set(url("./list.png") 1x)}',
  ],
  [
    '@import "./base.css";@import "https://fonts.example.test/x.css";.x{--icon:url("./icon.svg");mask-image:url("./mask.svg");cursor:url("./cursor.png"),auto}@font-face{src:url("./font.woff2")}',
    '@import "./base.css";@import "https://fonts.example.test/x.css";.x{--icon:url("./icon.svg");mask-image:url("./mask.svg");cursor:url("./cursor.png"),auto}@font-face{src:url("./font.woff2")}',
  ],
] as const;

for (const [input, expected] of cases)
  test(`restore local image-set first-token strings: ${input}`, () => {
    assert.equal(restoreModuleImageSetUrls(input), expected);
  });

test("post-transform guard has Lightning-specific guidance", async () => {
  const { validateTransformedImageSetStrings } =
    await import("../dist/build/styles/image_set.js");
  assert.throws(
    () =>
      validateTransformedImageSetStrings(
        'a{background:image-set("./missed.png" 1x)}',
        "/repo/src/card.module.css",
        "/repo",
      ),
    (error: Error) => {
      assert.equal(
        error.message,
        "[mokly/build-invalid] Lightning CSS left an unhandled image-set() URL in src/card.module.css: ./missed.png; use a plain CSS file for this declaration or report the issue to Mokly",
      );
      return true;
    },
  );
});
