/** One source-located default-tree parse, with provenance captured at the parser token boundary. */
import {
  Parser,
  html,
  type DefaultTreeAdapterMap,
  type ParserOptions,
  type Token,
} from "parse5";

import type { HtmlParseStep } from "../diagnostics/document_work.js";
import { timingDocumentWork } from "../diagnostics/timings.js";

import { PageSourceLocations } from "./page_source_locations.js";

const foreignAtEnd = new WeakSet<DefaultTreeAdapterMap["document"]>();

/** EOF state belongs to the original parse; consumers must not parse again. */
export function hasOpenForeignContent(
  document: DefaultTreeAdapterMap["document"],
): boolean {
  return foreignAtEnd.has(document);
}

class PageParser extends Parser<DefaultTreeAdapterMap> {
  private readonly locations: PageSourceLocations;

  constructor(options?: ParserOptions<DefaultTreeAdapterMap>) {
    const locations = new PageSourceLocations();
    super({
      ...options,
      sourceCodeLocationInfo: true,
      treeAdapter: locations.adapter,
    });
    this.locations = locations;
  }

  override onStartTag(token: Token.TagToken): void {
    this.locations.startTag(token);
    super.onStartTag(token);
  }

  override onEndTag(token: Token.TagToken): void {
    this.locations.processing(token);
    super.onEndTag(token);
  }

  override onCharacter(token: Token.CharacterToken): void {
    this.locations.processing(token);
    super.onCharacter(token);
  }

  override onWhitespaceCharacter(token: Token.CharacterToken): void {
    this.locations.processing(token);
    super.onWhitespaceCharacter(token);
  }

  override onNullCharacter(token: Token.CharacterToken): void {
    this.locations.processing(token);
    super.onNullCharacter(token);
  }

  override onComment(token: Token.CommentToken): void {
    this.locations.processing(token);
    super.onComment(token);
  }

  override onDoctype(token: Token.DoctypeToken): void {
    this.locations.processing(token);
    super.onDoctype(token);
  }

  override onEof(token: Token.EOFToken): void {
    this.locations.processing(token);
    for (let index = 0; index <= this.openElements.stackTop; index++) {
      const node = this.openElements.items[index]!;
      if (
        "namespaceURI" in node &&
        (node.namespaceURI === html.NS.SVG ||
          node.namespaceURI === html.NS.MATHML)
      ) {
        foreignAtEnd.add(this.document);
        break;
      }
    }
    super.onEof(token);
  }
}

export function parsePageDocument(
  step: HtmlParseStep,
  source: string,
): DefaultTreeAdapterMap["document"] {
  const work = timingDocumentWork();
  return work
    ? work.parse(step, source, () =>
        PageParser.parse<DefaultTreeAdapterMap>(source, {
          sourceCodeLocationInfo: true,
        }),
      )
    : PageParser.parse<DefaultTreeAdapterMap>(source, {
        sourceCodeLocationInfo: true,
      });
}
