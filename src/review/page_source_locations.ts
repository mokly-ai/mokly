/** Capture source origins directly from the tokens used by the default tree builder. */
import {
  defaultTreeAdapter,
  type DefaultTreeAdapterMap,
  type Token,
  type TreeAdapter,
} from "parse5";

import { MoklyError } from "../errors.js";

type Element = DefaultTreeAdapterMap["element"];
type Attribute = Element["attrs"][number];
type Span = { startOffset: number; endOffset: number };
const documents = new WeakSet<DefaultTreeAdapterMap["document"]>();
const validated = new WeakSet<DefaultTreeAdapterMap["document"]>();
const originals = new WeakMap<Element, Element>();
const positions = new WeakMap<Element, number>();
const attributes = new WeakMap<Attribute, Span>();

export class PageSourceLocations {
  private readonly tokens = new WeakMap<
    Element["attrs"],
    { startOffset: number; original?: Element }
  >();
  private currentOffset: number | undefined;
  readonly adapter: TreeAdapter<DefaultTreeAdapterMap> = {
    ...defaultTreeAdapter,
    createDocument: () => {
      const document = defaultTreeAdapter.createDocument();
      documents.add(document);
      return document;
    },
    createElement: (tag, namespace, attrs) => {
      const element = defaultTreeAdapter.createElement(tag, namespace, attrs);
      const token = this.tokens.get(attrs);
      const offset = token?.startOffset ?? this.currentOffset;
      if (offset !== undefined) positions.set(element, offset);
      if (token) {
        if (token.original) originals.set(element, token.original);
        else token.original = element;
      }
      return element;
    },
    adoptAttributes: (recipient, attrs) => {
      if (!this.tokens.has(attrs))
        throw new MoklyError(
          "review-invalid",
          "adopted attributes have no parser token provenance",
        );
      defaultTreeAdapter.adoptAttributes(recipient, attrs);
    },
  };

  processing(token: Token.Token): void {
    this.currentOffset = token.location?.startOffset;
  }

  startTag(token: Token.TagToken): void {
    this.processing(token);
    if (!token.location) return;
    if (!this.tokens.has(token.attrs))
      this.tokens.set(token.attrs, { startOffset: token.location.startOffset });
    for (const attribute of token.attrs) {
      const name = attribute.prefix
        ? `${attribute.prefix}:${attribute.name}`
        : attribute.name;
      const span = token.location.attrs?.[name];
      if (span && !attributes.has(attribute))
        attributes.set(attribute, {
          startOffset: span.startOffset,
          endOffset: span.endOffset,
        });
    }
  }
}

function requirePageSourceLocations(
  document: DefaultTreeAdapterMap["document"],
): void {
  if (!documents.has(document))
    throw new MoklyError(
      "review-invalid",
      "unregistered page source provenance",
    );
}

export function withPageSourceValidation<Result>(
  document: DefaultTreeAdapterMap["document"],
  analyze: (validate: ((element: Element) => void) | undefined) => Result,
): Result {
  requirePageSourceLocations(document);
  const validate = validated.has(document)
    ? undefined
    : (element: Element) => {
        if (!element.sourceCodeLocation) pageCreationOffset(element);
        const original = originalPageElement(element);
        if (original !== element && !original.sourceCodeLocation)
          throw new MoklyError(
            "review-invalid",
            "formatting clone has no located original provenance",
          );
      };
  const result = analyze(validate);
  validated.add(document);
  return result;
}

export function originalPageElement(element: Element): Element {
  return originals.get(element) ?? element;
}

export function pageCreationOffset(element: Element): number {
  const offset = positions.get(originalPageElement(element));
  if (offset === undefined)
    throw new MoklyError(
      "review-invalid",
      "element has no creating token provenance",
    );
  return offset;
}

export function pageAttributeLocation(attribute: Attribute): Span | undefined {
  return attributes.get(attribute);
}
