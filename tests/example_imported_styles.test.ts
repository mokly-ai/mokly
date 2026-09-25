import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { parse } from "parse5";

import {
  attribute,
  designCatalogue,
  elements,
} from "./helpers/design_catalogue.js";
import { textOutput } from "./helpers/generated_text.js";

const stylesheetRoute =
  "mokly-generated/styles/examples/basic/entries/catalogue.mockup.tsx.css";
const imageRoute =
  "mokly-generated/assets/examples/basic/src/components/workspace-note/signal.png";

test("example Welcome delivers scoped CSS, Tailwind utilities, prefixes and a binary image", async () => {
  const { manifest, outputs } = await designCatalogue;
  const stylesheet = textOutput(outputs, stylesheetRoute);
  assert.ok(stylesheet, "entry stylesheet is bundled");
  assert.match(stylesheet, /mokly_\w+_note/);
  assert.match(stylesheet, /\.px-3\b/);
  assert.match(stylesheet, /\.note-title\b/);
  assert.match(stylesheet, /-webkit-user-select:\s*none/);
  assert.match(stylesheet, /signal\.png/);
  assert.doesNotMatch(stylesheet, /\*,\s*::before,\s*::after\s*\{/);
  const image = outputs.get(imageRoute);
  assert.ok(image instanceof Uint8Array);
  assert.ok(image.byteLength < 512);
  assert.deepEqual(
    [...image.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
  );

  const welcome = manifest.entries.find(
    (entry) => entry.id === "example-welcome",
  );
  assert.ok(welcome?.kind === "screen" && welcome.darkFragments);
  for (const route of [
    ...Object.values(welcome.fragments),
    ...Object.values(welcome.darkFragments),
  ]) {
    const document = parse(textOutput(outputs, route) ?? "");
    const stylesheets = elements(
      document,
      (node) =>
        node.tagName === "link" && attribute(node, "rel") === "stylesheet",
    );
    assert.ok(
      stylesheets.some(
        (link) =>
          path.posix.normalize(
            path.posix.join(
              path.posix.dirname(route),
              attribute(link, "href") ?? "",
            ),
          ) === stylesheetRoute,
      ),
      `missing imported stylesheet on ${route}`,
    );
    const notes = elements(
      document,
      (node) =>
        node.tagName === "aside" &&
        attribute(node, "aria-label") === "Workspace tip",
    );
    assert.equal(notes.length, 1, `missing styled component on ${route}`);
    assert.match(attribute(notes[0]!, "class") ?? "", /mokly_\w+_note/);
  }
});
