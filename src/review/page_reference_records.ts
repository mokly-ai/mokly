/** Original-source reference occurrences, including inert records available to copies. */
import type { DefaultTreeAdapterMap } from "parse5";

import type {
  MaterialRecipe,
  SourceSpan,
} from "../components/material_recipe.js";
import { documentWorkSync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";
import {
  htmlReferenceValues,
  type HtmlReferenceValue,
} from "../html_reference_values.js";
import type {
  HtmlReferenceOptions,
  HtmlReferences,
} from "../html_references.js";

import {
  pageAttributeLocation,
  withPageSourceValidation,
} from "./page_source_locations.js";

export interface PageReferenceRecord extends SourceSpan, HtmlReferenceValue {
  inertAncestors: readonly SourceSpan[];
  spelling: string;
}

export function pageReferenceRecords(
  source: string,
  document: DefaultTreeAdapterMap["document"],
  options: HtmlReferenceOptions = {},
  observe?: (
    node: DefaultTreeAdapterMap["node"],
    inert: readonly SourceSpan[],
  ) => void,
) {
  return documentWorkSync("referenceMs", () =>
    withPageSourceValidation(document, (validate) => {
      const result: PageReferenceRecord[] = [];
      const visit = (
        node: DefaultTreeAdapterMap["node"],
        inertAncestors: readonly SourceSpan[],
      ) => {
        if ("tagName" in node) validate?.(node);
        observe?.(node, inertAncestors);
        const location =
          "tagName" in node ? node.sourceCodeLocation : undefined;
        const textLocation =
          "tagName" in node && node.tagName === "style"
            ? styleTextLocation(node)
            : undefined;
        for (const reference of htmlReferenceValues(node, options)) {
          const attribute =
            reference.attribute && "attrs" in node
              ? node.attrs.findLast(
                  (attribute) => attribute.name === reference.attribute,
                )
              : undefined;
          const span = reference.attribute
            ? attribute
              ? pageAttributeLocation(attribute)
              : undefined
            : textLocation;
          if (!span)
            throw new MoklyError(
              "review-invalid",
              "reference has no parser token provenance",
            );
          result.push({
            ...reference,
            start: span.startOffset,
            end: span.endOffset,
            spelling: source.slice(span.startOffset, span.endOffset),
            inertAncestors,
          });
        }
        if ("childNodes" in node)
          for (const child of node.childNodes) visit(child, inertAncestors);
        if ("content" in node)
          visit(
            node.content,
            location
              ? [
                  ...inertAncestors,
                  { start: location.startOffset, end: location.endOffset },
                ]
              : inertAncestors,
          );
      };
      visit(document, []);
      return result;
    }),
  );
}

function styleTextLocation(
  node: DefaultTreeAdapterMap["node"],
): { startOffset: number; endOffset: number } | undefined {
  if (!("childNodes" in node)) return;
  let span: { startOffset: number; endOffset: number } | undefined;
  for (const child of node.childNodes) {
    const location = "value" in child ? child.sourceCodeLocation : undefined;
    if (location)
      span = {
        startOffset: Math.min(
          span?.startOffset ?? location.startOffset,
          location.startOffset,
        ),
        endOffset: Math.max(
          span?.endOffset ?? location.endOffset,
          location.endOffset,
        ),
      };
  }
  return span;
}

export function originalPageReferences(
  records: readonly PageReferenceRecord[],
): HtmlReferences {
  const visible = records.filter(
    ({ inertAncestors }) => !inertAncestors.length,
  );
  return {
    anchors: new Set(
      visible.filter(({ kind }) => kind === "anchor").map(({ value }) => value),
    ),
    hrefs: visible
      .filter(({ kind }) => kind === "navigation")
      .map(({ value }) => value),
    resources: visible.filter(isResource).map(({ value }) => value),
  };
}

export function deriveMaterialReferences(
  records: readonly PageReferenceRecord[],
  recipe: MaterialRecipe,
  removed: readonly SourceSpan[],
): string[] {
  return documentWorkSync("referenceMs", () => {
    const pieces: MaterialRecipe[number][] = [];
    for (const piece of recipe) {
      const previous = pieces.at(-1);
      if (
        piece.kind === "source" &&
        previous?.kind === "source" &&
        piece.start === previous.end &&
        piece.copy === previous.copy
      )
        pieces[pieces.length - 1] = { ...previous, end: piece.end };
      else if (piece.kind !== "insert" || piece.text) pieces.push(piece);
    }
    return pieces.flatMap((piece) => {
      if (piece.kind === "insert") return piece.references;
      return records
        .filter(
          (record) =>
            isResource(record) &&
            contains(piece, record) &&
            !removed.some((span) => intersects(span, record)) &&
            (piece.copy
              ? !record.inertAncestors.some((ancestor) =>
                  pieces.some(
                    (kept) =>
                      kept.kind === "source" &&
                      kept.copy === piece.copy &&
                      kept.start <= ancestor.start &&
                      ancestor.start < kept.end,
                  ),
                )
              : !record.inertAncestors.length),
        )
        .map(({ value }) => value);
    });
  });
}

function isResource(record: HtmlReferenceValue): boolean {
  return record.kind !== "anchor" && record.kind !== "navigation";
}
function contains(outer: SourceSpan, inner: SourceSpan): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}
function intersects(left: SourceSpan, right: SourceSpan): boolean {
  return left.start < right.end && right.start < left.end;
}
