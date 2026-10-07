/** One lazy original-page tree per component-aware view side. */
import { html, type DefaultTreeAdapterMap } from "parse5";

import type { ComponentViewRecord } from "@mokly/viewer";
import { invalidData } from "@mokly/viewer/data";

import { stripGeneratedFirstLine } from "../build/generated_marker.js";
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
import { documentWorkSync } from "../diagnostics/timings.js";

import { setDocumentSubjectFilter } from "./css/document_subjects.js";
import { inlineStyleSpan, type InlineStyleSpan } from "./css/inline_styles.js";
import {
  parseReviewDocument,
  reviewMaterialSignals,
  type ReviewIgnoreRegion,
} from "./ignore.js";
import { hasOpenForeignContent, parsePageDocument } from "./page_parser.js";
import {
  deriveMaterialReferences,
  pageReferenceRecords,
  type PageReferenceRecord,
} from "./page_reference_records.js";
import { pageSubjectFilter } from "./page_subjects.js";

export class PageAnalysis {
  readonly regions: readonly ReviewIgnoreRegion[];
  private ids?: ReadonlySet<string>;
  private signals?: readonly (SourceSpan & { id: string })[];
  private components?: readonly SourceSpan[];
  private readonly originalMaterials?: ReadonlyMap<string, string>;
  readonly headerEnd: number;
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
    {
      const { regions, materials } = parseReviewDocument(source, route);
      this.regions = [...regions.values()];
      if (materials.size) this.originalMaterials = materials;
    }
    this.headerEnd = source.length - stripGeneratedFirstLine(source).length;
    this.document = parsePageDocument("pageAnalysis", source);
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
    if (this.headerEnd)
      this.removedMarkers = [
        { start: 0, end: this.headerEnd },
        ...this.removedMarkers,
      ];
  }

  get materialIds(): ReadonlySet<string> {
    return (this.ids ??= new Set(this.originalMaterials?.keys()));
  }

  get openForeignContent(): boolean {
    return hasOpenForeignContent(this.document);
  }

  /** Paired ignores can remove an explicit or parser-implied foreign closer. */
  foreignContentMayStayOpen(paired: readonly string[]): boolean {
    if (this.openForeignContent) return true;
    const regions = this.ignored(paired);
    if (!regions.length) return false;
    const visit = (node: DefaultTreeAdapterMap["node"]): boolean => {
      if ("tagName" in node) {
        const location = node.sourceCodeLocation;
        if (
          (node.namespaceURI === html.NS.SVG ||
            node.namespaceURI === html.NS.MATHML) &&
          location?.startTag &&
          regions.some(
            ({ start, end }) =>
              location.startTag!.startOffset < start &&
              start <= location.endOffset &&
              location.endOffset <= end,
          )
        )
          return true;
      }
      return (
        ("childNodes" in node && node.childNodes.some(visit)) ||
        ("content" in node && visit(node.content))
      );
    };
    return visit(this.document);
  }

  get materialSignals(): readonly (SourceSpan & { id: string })[] {
    return (this.signals ??= this.originalMaterials
      ? reviewMaterialSignals(this.source)
      : []);
  }

  get componentMarkers(): readonly SourceSpan[] {
    return (this.components ??= this.removedMarkers.filter(({ start }) =>
      this.source.startsWith("<!--mokly-component:", start),
    ));
  }

  ignored(paired: readonly string[]): readonly ReviewIgnoreRegion[] {
    return this.regions.filter(({ id }) => paired.includes(id));
  }

  matching(paired: readonly string[]): DefaultTreeAdapterMap["document"] {
    const ignored = this.ignored(paired);
    setDocumentSubjectFilter(this.document, pageSubjectFilter(ignored));
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

  /** In-place identities must survive every delivered marker/header rewrite. */
  sourceEditsIntersect(spans: readonly SourceSpan[]): boolean {
    return [...this.removedMarkers, ...this.materialSignals].some((edit) =>
      spans.some((span) => edit.start < span.end && span.start < edit.end),
    );
  }

  /** Canonical rules can restore a reference lost by raw source-span removal. */
  hasDroppedStyleReferences(paired: readonly string[]): boolean {
    const styles = this.inlineStyles(paired);
    const removed = [...this.removedMarkers, ...this.ignored(paired)];
    return this.references.some(
      (record) =>
        record.kind !== "anchor" &&
        record.kind !== "navigation" &&
        styles.some(
          (span) => span.start <= record.start && record.end <= span.end,
        ) &&
        removed.some(
          (span) => span.start < record.end && record.start < span.end,
        ),
    );
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
