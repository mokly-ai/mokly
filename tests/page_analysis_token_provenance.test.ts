import assert from "node:assert/strict";
import test from "node:test";

import { parse, type DefaultTreeAdapterMap } from "parse5";

import { MoklyError } from "../dist/errors.js";
import { PageAnalysis } from "../dist/review/page_analysis.js";
import { pageReferenceRecords } from "../dist/review/page_reference_records.js";
import { originalPageElement } from "../dist/review/page_source_locations.js";

for (const tag of ["body", "html"])
  for (const kind of ["end-tag", "ignored-tag", "adopted-tag", "doctype"])
    test(`${tag} attribute provenance uses the actual token, not a ${kind} attribute lookalike`, () => {
      const attribute = 'style="background:url(token.svg)"';
      const actual = `<${tag} ${attribute}>`;
      const hidden = {
        "end-tag": `</div title='${actual}'>`,
        "ignored-tag": `<tr title='${actual}'>`,
        "adopted-tag": `<body title='${actual}'>`,
        doctype: `<!DOCTYPE html PUBLIC '${actual}'>`,
      }[kind]!;
      const source = `\uFEFF😀\r\n<p>a</p>${hidden}${actual}`;
      const record = new PageAnalysis(source, "token.html").references.find(
        ({ value }) => value === "token.svg",
      )!;
      assert.ok(record);
      assert.equal(record.start, source.lastIndexOf(attribute));
      assert.equal(record.end, record.start + attribute.length);
      assert.equal(record.spelling, attribute);
    });

for (const namespace of ["svg", "math"])
  for (const container of ["template", "select"])
    for (const integration of namespace === "svg"
      ? ["foreignObject"]
      : ["annotation-xml", "mi"])
      test(`adopted attributes survive ${namespace} ${container}/${integration}`, () => {
        const attribute = 'style="background:url(foreign.svg)"';
        const opening =
          integration === "annotation-xml"
            ? '<annotation-xml encoding="text/html">'
            : `<${integration}>`;
        const source = `<p>a</p><${namespace}><${container}>${opening}<body ${attribute}></${integration}></${container}></${namespace}>`;
        const record = new PageAnalysis(source, "foreign.html").references.find(
          ({ value }) => value === "foreign.svg",
        )!;
        assert.ok(record);
        assert.equal(record.start, source.indexOf(attribute));
        assert.equal(record.spelling, attribute);
      });

test("HTML select adopts html attributes but discards body attributes", () => {
  const source =
    '<p>a</p><select><html style="background:url(root.svg)"><body style="background:url(discarded.svg)"></select>';
  const references = new PageAnalysis(source, "select.html").references;
  assert.deepEqual(
    references.map(({ value }) => value),
    ["root.svg"],
  );
  assert.equal(
    references[0]!.start,
    source.indexOf('style="background:url(root.svg)"'),
  );
});

test("production formatting clones retain the original start-tag reference span", () => {
  const attribute = 'style="background:url(clone.svg)"';
  const source = `<b ${attribute}><p>inside</b>outside</p>`;
  const analysis = new PageAnalysis(source, "clone.html");
  const nodes: Parameters<typeof originalPageElement>[0][] = [];
  const visit = (node: DefaultTreeAdapterMap["node"]) => {
    if ("tagName" in node && node.tagName === "b") nodes.push(node);
    if ("childNodes" in node) for (const child of node.childNodes) visit(child);
  };
  visit(analysis.document);
  assert.equal(nodes.length, 2);
  const original = nodes.find((node) => node.sourceCodeLocation)!;
  const clone = nodes.find((node) => !node.sourceCodeLocation)!;
  assert.ok(original);
  assert.ok(clone);
  assert.equal(originalPageElement(clone), original);
  assert.equal(analysis.references.length, 2);
  for (const reference of analysis.references) {
    assert.equal(reference.start, source.indexOf(attribute));
    assert.equal(reference.spelling, attribute);
  }
});

test("an unregistered reader tree fails with a typed internal diagnostic, never recovery", () => {
  const source = '<p>a</p><body style="background:url(root.svg)">';
  const document = parse(source, { sourceCodeLocationInfo: true });
  assert.throws(
    () => pageReferenceRecords(source, document, {}),
    (error: unknown) =>
      error instanceof MoklyError &&
      error.code === "review-invalid" &&
      /unregistered page source provenance/.test(error.message),
  );
});
