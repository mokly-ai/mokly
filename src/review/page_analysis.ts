/** One lazy original-page tree per component-aware view side. */
import type { DefaultTreeAdapterMap } from "parse5";

import type { ComponentViewRecord } from "@mokly/viewer";
import { invalidData } from "@mokly/viewer/data";

import { generatedSource } from "../build/ownership.js";
import {
  callerSlotRanges,
  type MaterialRecipe,
  type MaterialPiece,
  type SourceSpan,
} from "../components/material_recipe.js";
import {
  validateComponentRanges,
  type RenderedRange,
} from "../components/ranges.js";
import { parseHtml } from "../diagnostics/html_parse.js";
import { documentWorkSync } from "../diagnostics/timings.js";

import { setDocumentSubjectFilter } from "./css/document_subjects.js";
import { inlineStyleSpan, type InlineStyleSpan } from "./css/inline_styles.js";
import { reviewIgnoreRegions, type ReviewIgnoreRegion } from "./ignore.js";
import {
  deriveMaterialReferences,
  pageReferenceRecords,
  type PageReferenceRecord,
} from "./page_reference_records.js";

export class PageAnalysis {
  readonly regions: readonly ReviewIgnoreRegion[];
  readonly document: DefaultTreeAdapterMap["document"];
  readonly ranges: readonly RenderedRange[];
  readonly references: readonly PageReferenceRecord[];
  private readonly removedMarkers: readonly SourceSpan[];
  private readonly styles: readonly InlineStyleSpan[];

  constructor(
    readonly source: string,
    readonly route: string,
    readonly usage?: ComponentViewRecord,
  ) {
    this.regions = reviewIgnoreRegions(source, route);
    this.document = parseHtml("pageAnalysis", source, {
      sourceCodeLocationInfo: true,
    });
    this.ranges = usage
      ? validateComponentRanges(source, usage.ranges, this.document)
      : [];
    if (
      this.ranges.some((range) =>
        this.regions.some(({ start, end }) =>
          [range.start, range.contentEnd].some(
            (offset) => start <= offset && offset < end,
          ),
        ),
      )
    )
      invalidData(
        "$document",
        "ReviewIgnore cannot enclose component or caller-slot boundaries",
      );
    const styles: InlineStyleSpan[] = [];
    this.references = pageReferenceRecords(
      source,
      this.document,
      { resourceHints: false },
      (node, inert) => {
        if (inert.length || !("tagName" in node) || node.tagName !== "style")
          return;
        documentWorkSync("styleDiscoveryMs", () => {
          const span = inlineStyleSpan(source, node);
          if (
            span &&
            !this.ranges.some(
              (range) =>
                range.contentStart <= span.start &&
                span.start < range.contentEnd,
            )
          )
            styles.push(span);
        });
      },
    );
    this.styles = styles.sort((left, right) => left.start - right.start);
    this.removedMarkers = [
      ...source.matchAll(
        /<!--mokly-component:(?:start|end):r-[0-9]+-->|<!--mokly-review-ignore:[\s\S]*?-->/g,
      ),
    ].map((match) => ({
      start: match.index,
      end: match.index + match[0].length,
    }));
    if (generatedSource(source))
      this.removedMarkers = [
        { start: 0, end: source.indexOf("\n") + 1 },
        ...this.removedMarkers,
      ];
  }

  ignored(paired: readonly string[]): readonly SourceSpan[] {
    return this.regions.filter(({ id }) => paired.includes(id));
  }

  matching(paired: readonly string[]): DefaultTreeAdapterMap["document"] {
    const ignored = this.ignored(paired);
    setDocumentSubjectFilter(this.document, (element) => {
      const offset = element.sourceCodeLocation?.startOffset;
      return (
        offset === undefined ||
        !ignored.some(({ start, end }) => start <= offset && offset < end)
      );
    });
    return this.document;
  }

  inlineStyles(paired: readonly string[]) {
    const ignored = this.ignored(paired);
    return this.styles.filter(
      (span) =>
        !ignored.some(
          ({ start, end }) => start <= span.start && span.start < end,
        ),
    );
  }

  materialReferences(recipe: MaterialRecipe, paired: readonly string[]) {
    return deriveMaterialReferences(this.references, recipe, [
      ...this.removedMarkers,
      ...this.ignored(paired),
    ]);
  }

  conservativeReferences(paired: readonly string[]) {
    const recipe: MaterialPiece[] = [
      { kind: "source", start: 0, end: this.source.length },
    ];
    for (const { range } of this.usage
      ? callerSlotRanges(this.usage, this.ranges)
      : [])
      if (range)
        recipe.push({
          kind: "source",
          start: range.contentStart,
          end: range.contentEnd,
          copy: { start: range.contentStart, end: range.contentEnd },
        });
    return this.materialReferences(recipe, paired);
  }
}
