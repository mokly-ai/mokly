import { parse, type DefaultTreeAdapterMap } from "parse5";

import type { ComponentRangeRecord, ComponentRangeTarget } from "@mokly/viewer";
import { canonicalJson, invalidData } from "@mokly/viewer/data";

type Node = DefaultTreeAdapterMap["node"];
export interface RenderedRange {
  record: ComponentRangeRecord;
  start: number;
  contentStart: number;
  contentEnd: number;
  end: number;
}
const prefix = "mokly-component:";

/** Turn authenticated inert React sentinels into layout-neutral comment pairs. */
export function serializeComponentSentinels(
  html: string,
  boundaries: ReadonlyMap<string, ComponentRangeTarget>,
): { html: string; ranges: ComponentRangeRecord[] } {
  const changes: { start: number; end: number; text: string }[] = [];
  const stack: { token: string; record: ComponentRangeRecord }[] = [];
  const seen = new Set<string>();
  const ranges: ComponentRangeRecord[] = [];
  visit(parse(html, { sourceCodeLocationInfo: true }), (node) => {
    if (
      node.nodeName === "#comment" &&
      "data" in node &&
      node.data.includes(prefix)
    )
      invalidData("$render", "reserved component comment");
    if (!("attrs" in node)) return;
    const attributes = node.attrs.filter((attribute) =>
      attribute.name.startsWith("data-mokly-component-"),
    );
    if (!attributes.length) return;
    const attribute = attributes[0]!;
    const location = node.sourceCodeLocation;
    const boundary =
      attribute.name === "data-mokly-component-start"
        ? "start"
        : attribute.name === "data-mokly-component-end"
          ? "end"
          : undefined;
    if (
      node.tagName !== "template" ||
      attributes.length !== 1 ||
      node.attrs.length !== 1 ||
      !boundary ||
      !location ||
      !new RegExp(
        `^<template data-mokly-component-${boundary}="b-[0-9]+"></template>$`,
      ).test(html.slice(location.startOffset, location.endOffset))
    )
      invalidData("$render", "forged or malformed component sentinel");
    const target = boundaries.get(attribute.value);
    if (!target) invalidData("$render", "unknown component sentinel");
    let record: ComponentRangeRecord;
    if (boundary === "start") {
      if (seen.has(attribute.value))
        invalidData("$render", "duplicate component sentinel");
      record = {
        id: `r-${ranges.length}`,
        target,
        ...(stack.at(-1) ? { parentId: stack.at(-1)!.record.id } : {}),
      };
      seen.add(attribute.value);
      ranges.push(record);
      stack.push({ token: attribute.value, record });
    } else {
      const opened = stack.pop();
      if (opened?.token !== attribute.value)
        invalidData("$render", "overlapping or unmatched component sentinel");
      record = opened.record;
    }
    changes.push({
      start: location.startOffset,
      end: location.endOffset,
      text: `<!--${prefix}${boundary}:${record.id}-->`,
    });
  });
  if (stack.length || seen.size !== boundaries.size)
    invalidData("$render", "missing component sentinel");
  for (const change of changes.sort((a, b) => b.start - a.start))
    html = html.slice(0, change.start) + change.text + html.slice(change.end);
  validateComponentRanges(html, ranges);
  return { html, ranges };
}

/** Validate DOM boundaries in the original document's UTF-16 coordinate space. */
export function validateComponentRanges(
  html: string,
  records: readonly ComponentRangeRecord[],
  dialect: "current" | "historical" = "current",
): RenderedRange[] {
  const expected = new Map(records.map((record) => [record.id, record]));
  const result: RenderedRange[] = [];
  const stack: {
    record: ComponentRangeRecord;
    start: number;
    contentStart: number;
  }[] = [];
  let starts = 0;
  let ignored = false;
  visit(parse(html, { sourceCodeLocationInfo: true }), (node) => {
    if (
      "attrs" in node &&
      node.attrs.some((attribute) =>
        attribute.name.startsWith("data-mokly-component-"),
      )
    )
      invalidData("$document", "reserved component attributes remain");
    if (node.nodeName !== "#comment" || !("data" in node)) return;
    const data =
      dialect === "historical"
        ? node.data.replace(/^mokabook-(component|review-ignore):/, "mokly-$1:")
        : node.data;
    if (data.startsWith("mokly-review-ignore:start:")) ignored = true;
    if (data.startsWith("mokly-review-ignore:end:")) ignored = false;
    if (!data.startsWith(prefix)) return;
    if (ignored)
      invalidData(
        "$document",
        "ReviewIgnore cannot enclose component or caller-slot boundaries",
      );
    const match = /^mokly-component:(start|end):(r-[0-9]+)$/.exec(data);
    const location = node.sourceCodeLocation;
    const record = expected.get(match?.[2] ?? "");
    if (!match || !record || !location)
      invalidData("$document", "unknown or malformed component boundary");
    if (match[1] === "start") {
      if (
        record.id !== `r-${starts++}` ||
        record.parentId !== stack.at(-1)?.record.id
      )
        invalidData("$document", "moved or duplicate component boundary");
      stack.push({
        record,
        start: location.startOffset,
        contentStart: location.endOffset,
      });
    } else {
      const opened = stack.pop();
      if (!opened || canonicalJson(opened.record) !== canonicalJson(record))
        invalidData("$document", "overlapping or unmatched component boundary");
      result.push({
        ...opened,
        contentEnd: location.startOffset,
        end: location.endOffset,
      });
    }
  });
  if (
    stack.length ||
    starts !== records.length ||
    result.length !== records.length
  )
    invalidData("$document", "missing component boundaries");
  return result.sort((a, b) => a.start - b.start);
}

function visit(node: Node, callback: (node: Node) => void): void {
  callback(node);
  if ("childNodes" in node)
    for (const child of node.childNodes) visit(child, callback);
  if ("content" in node) visit(node.content, callback);
}
