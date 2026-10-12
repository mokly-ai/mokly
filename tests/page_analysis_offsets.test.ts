import assert from "node:assert/strict";
import test from "node:test";

import { validateComponentRanges } from "../dist/components/ranges.js";
import { normalizeSingleDocument } from "../dist/review/ignore.js";
import { PageAnalysis } from "../dist/review/page_analysis.js";

import {
  html,
  instance,
  markedRange,
  range,
  view,
} from "./helpers/inline_styles.js";

test("ranges, style content, reference spans and ignore spans use original UTF-16 offsets", () => {
  const component = instance(1, "action");
  const usage = view({
    instances: [component],
    ranges: [range(0, { kind: "instance", instanceKey: component.key })],
  });
  const source =
    "\uFEFF\r\n😀" +
    html(
      "<style>\r\n.a{color:red}</style>",
      markedRange(0, '<img src="inside.svg">') +
        "<!--mokly-review-ignore:start:decor-->😀\r\n<i></i><!--mokly-review-ignore:end:decor-->",
    );
  const analysis = new PageAnalysis(source, "test.html", usage);
  assert.deepEqual(
    analysis.ranges,
    validateComponentRanges(source, usage.ranges),
  );
  const selected = analysis.ranges[0]!;
  assert.equal(selected.start, source.indexOf("<!--mokly-component:start:"));
  assert.equal(
    source.slice(selected.contentStart, selected.contentEnd),
    '<img src="inside.svg">',
  );
  assert.notEqual(
    selected.start,
    Buffer.byteLength(source.slice(0, selected.start)),
  );
  const style = analysis.inlineStyles([])[0]!;
  assert.equal(
    source.slice(style.contentStart, style.contentEnd),
    "\r\n.a{color:red}",
  );
  const ignored = analysis.regions[0]!;
  assert.equal(source.slice(ignored.start, ignored.end), "😀\r\n<i></i>");
  assert.equal(ignored.start, source.indexOf("😀\r\n<i>"));
  const reference = analysis.references.find(
    ({ value }) => value === "inside.svg",
  )!;
  assert.equal(reference.start, source.indexOf('src="inside.svg"'));
  assert.equal(reference.end, reference.start + 'src="inside.svg"'.length);
});

for (const enclosed of [false, true])
  test(`mixed DOM/raw-text ignore end uses only flat boundary enclosure, enclosed=${enclosed}`, () => {
    const component = instance(1, "action");
    const usage = view({
      instances: [component],
      ranges: [range(0, { kind: "instance", instanceKey: component.key })],
    });
    const start = "<!--mokly-review-ignore:start:mixed--><i>clock</i>";
    const end = "<textarea><!--mokly-review-ignore:end:mixed--></textarea>";
    const owned = markedRange(0, "<button>Owned</button>");
    const source = html("", start + (enclosed ? owned + end : end + owned));
    if (enclosed)
      assert.throws(
        () => new PageAnalysis(source, "mixed.html", usage),
        /ReviewIgnore cannot enclose component or caller-slot boundaries/,
      );
    else
      assert.equal(
        new PageAnalysis(source, "mixed.html", usage).ranges.length,
        1,
      );
  });

for (const markers of [
  "<!--mokly-review-ignore:start:open-->",
  "<!--mokly-review-ignore:start:bad id--><!--mokly-review-ignore:end:bad id-->",
  "<!--mokly-review-ignore:start:x--><!--mokly-review-ignore:start:y--><!--mokly-review-ignore:end:y--><!--mokly-review-ignore:end:x-->",
  "<!--mokly-review-material:x:" + "a".repeat(64) + "-->",
])
  test(`invalid flat ignore syntax retains delivered diagnostics: ${markers}`, () => {
    let expected: unknown;
    try {
      normalizeSingleDocument(markers, "original.html");
    } catch (error) {
      expected = error;
    }
    assert.ok(expected instanceof Error);
    assert.throws(() => new PageAnalysis(markers, "original.html", view()), {
      constructor: expected.constructor,
      message: expected.message,
    });
  });

test("malformed ownership and flat raw-text regions fail validation rather than falling back", () => {
  const component = instance(1, "action");
  const usage = view({
    instances: [component],
    ranges: [range(0, { kind: "instance", instanceKey: component.key })],
  });
  const missing = html("", "<button>missing boundaries</button>");
  assert.throws(
    () => new PageAnalysis(missing, "test.html", usage),
    /\$document.*missing component boundaries/,
  );
  const source = html(
    "",
    "<textarea><!--mokly-review-ignore:start:raw--></textarea>" +
      markedRange(0, "<button>Owned</button>") +
      "<textarea><!--mokly-review-ignore:end:raw--></textarea>",
  );
  assert.throws(
    () => new PageAnalysis(source, "test.html", usage),
    /ReviewIgnore cannot enclose component or caller-slot boundaries/,
  );
});
