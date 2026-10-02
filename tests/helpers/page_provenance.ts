import assert from "node:assert/strict";

import { parseFragment, type DefaultTreeAdapterMap } from "parse5";

import { htmlReferenceValues } from "../../dist/html_reference_values.js";
import type { HtmlReferenceOptions } from "../../dist/html_references.js";
import type { PageReferenceRecord } from "../../dist/review/page_reference_records.js";
import {
  originalPageElement,
  pageCreationOffset,
} from "../../dist/review/page_source_locations.js";

export function assertPageProvenance(
  source: string,
  document: DefaultTreeAdapterMap["document"],
  records: readonly PageReferenceRecord[],
  options: HtmlReferenceOptions,
) {
  const elements: DefaultTreeAdapterMap["element"][] = [];
  const shared = new Map<
    DefaultTreeAdapterMap["element"]["attrs"],
    DefaultTreeAdapterMap["element"][]
  >();
  let index = 0;
  const visit = (node: DefaultTreeAdapterMap["node"]) => {
    if ("tagName" in node) {
      elements.push(node);
      const group = shared.get(node.attrs) ?? [];
      group.push(node);
      shared.set(node.attrs, group);
      if (!node.sourceCodeLocation) {
        const offset = pageCreationOffset(node);
        assert.ok(
          Number.isInteger(offset) && offset >= 0 && offset <= source.length,
          `${node.tagName}: creating-token offset`,
        );
      }
      const original = originalPageElement(node);
      if (original !== node)
        assert.ok(
          original.sourceCodeLocation,
          `${node.tagName}: located clone original`,
        );
    }
    for (const reference of htmlReferenceValues(node, options)) {
      const record = records[index++]!;
      assert.ok(record, "every extractor value has a record");
      assert.equal(record.kind, reference.kind);
      assert.equal(record.attribute, reference.attribute);
      assert.equal(record.value, reference.value);
      assert.equal(record.spelling, source.slice(record.start, record.end));
      if (reference.attribute && "attrs" in node) {
        const attribute = node.attrs.findLast(
          (item) => item.name === reference.attribute,
        )!;
        const fragment = parseFragment(`<i ${record.spelling}></i>`);
        const parsed = fragment.childNodes[0]!;
        assert.ok("attrs" in parsed);
        assert.equal(
          parsed.attrs.length,
          1,
          "complete containing attribute, no adjacent token",
        );
        assert.equal(
          parsed.attrs[0]!.name,
          attribute.prefix
            ? `${attribute.prefix}:${attribute.name}`
            : attribute.name,
        );
        assert.equal(
          parsed.attrs[0]!.value,
          attribute.value,
          "decoded producer value",
        );
      } else if (reference.kind === "styleText" && "childNodes" in node) {
        const locations = node.childNodes.flatMap((child) =>
          "value" in child && child.sourceCodeLocation
            ? [child.sourceCodeLocation]
            : [],
        );
        assert.ok(locations.length);
        const start = Math.min(
          ...locations.map((location) => location.startOffset),
        );
        const end = Math.max(
          ...locations.map((location) => location.endOffset),
        );
        assert.equal(record.start, start);
        assert.equal(record.end, end);
        assert.equal(
          record.spelling,
          source.slice(start, end),
          "all contributing style text",
        );
      }
    }
    if ("childNodes" in node) for (const child of node.childNodes) visit(child);
    if ("content" in node) visit(node.content);
  };
  visit(document);
  assert.equal(index, records.length);
  for (const group of shared.values())
    if (group.length > 1) {
      const original = originalPageElement(group[0]!);
      assert.ok(
        original.sourceCodeLocation,
        "shared-token clone original is located",
      );
      for (const element of group)
        assert.equal(
          originalPageElement(element),
          original,
          "each shared-token occurrence has the same original",
        );
    }
  assert.ok(elements.length, "corpus exercises real tree elements");
}
