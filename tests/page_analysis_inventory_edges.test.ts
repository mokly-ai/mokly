import assert from "node:assert/strict";
import test from "node:test";

import { findUnownedInlineStyles } from "../dist/review/css/inline_styles.js";
import { PageAnalysis } from "../dist/review/page_analysis.js";
import { deriveMaterialReferences } from "../dist/review/page_reference_records.js";
import { analyzeResourceDocument } from "../dist/review/resource_document_analysis.js";

for (const tag of ["body", "html"])
  test(`adopted ${tag} attribute provenance ignores authored start-tag lookalikes`, () => {
    const attribute = 'style="background:url(adopted.svg)"';
    const lookalike = `<${tag} ${attribute}>`;
    const prefix = `\uFEFF😀\r\n<html><head></head><body><p>text</p><!--${lookalike}--><script>'${lookalike}'</script><textarea>${lookalike}</textarea><div data-value='${lookalike}'></div><template>${lookalike}</template>${tag === "body" ? `<select>${lookalike}</select>` : ""}`;
    const foreign = `<svg>before<![CDATA[${lookalike}]]>after</svg><math><![CDATA[${lookalike}]]></math>`;
    const source = `${prefix}${foreign}${lookalike}after`;
    const analysis = new PageAnalysis(source, "adopted.html");
    const records = analysis.references.filter(
      ({ value, inertAncestors }) =>
        value === "adopted.svg" && !inertAncestors.length,
    );
    assert.equal(records.length, 1);
    assert.equal(
      records[0]!.start,
      prefix.length + foreign.length + tag.length + 2,
    );
    assert.equal(records[0]!.end, records[0]!.start + attribute.length);
    assert.equal(records[0]!.spelling, attribute);
    const recipe = [{ kind: "source" as const, start: 0, end: source.length }];
    assert.deepEqual(
      deriveMaterialReferences(records, recipe, [
        { start: prefix.length, end: source.length },
      ]),
      [],
    );
  });

test("style discovery exposes only its three consumed inputs", () => {
  assert.equal(findUnownedInlineStyles.length, 3);
});

test("embedded analysis keeps visible records and leaves normalization to its reader", () => {
  const source =
    '<!--mokly-review-ignore:start:clock--><img src="clock.svg"><!--mokly-review-ignore:end:clock--><img src="visible.svg"><template><img src="inert.svg"></template>';
  assert.deepEqual(
    analyzeResourceDocument(source, source, "frame.html", "resourceReference")
      .references,
    ["clock.svg", "visible.svg"],
  );
});

test("split SVG style records span all contributing text and ignore intersection with only the last text", () => {
  const first = "a{background:url(first.svg)}";
  const last = "b{background:url(last.svg)}";
  const source = `<svg><style>${first}<!--mokly-review-ignore:start:later-->${last}<!--mokly-review-ignore:end:later--></style></svg>`;
  const analysis = new PageAnalysis(source, "split.html");
  assert.equal(analysis.references.length, 2);
  for (const record of analysis.references) {
    assert.equal(record.start, source.indexOf(first));
    assert.equal(record.end, source.indexOf(last) + last.length);
    assert.equal(record.spelling, source.slice(record.start, record.end));
  }
  const recipe = [{ kind: "source" as const, start: 0, end: source.length }];
  assert.deepEqual(deriveMaterialReferences(analysis.references, recipe, []), [
    "first.svg",
    "last.svg",
  ]);
  assert.deepEqual(analysis.materialReferences(recipe, ["later"]), []);
});
