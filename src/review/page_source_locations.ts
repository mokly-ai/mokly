/** Default-tree nodes retain the provenance of adopted attributes and formatting clones. */
import {
  defaultTreeAdapter,
  html,
  type DefaultTreeAdapterMap,
  type TreeAdapter,
} from "parse5";

import { rootAttributeLocations } from "./page_root_attributes.js";

type Element = DefaultTreeAdapterMap["element"];
type Attribute = Element["attrs"][number];
type Location = { startOffset: number; endOffset: number };
const formatting = new Set([
  "a",
  "b",
  "big",
  "code",
  "em",
  "font",
  "i",
  "nobr",
  "s",
  "small",
  "strike",
  "strong",
  "tt",
  "u",
]);
const originals = new WeakMap<Element, Element>();
const attributes = new WeakMap<Attribute, Location>();
const adopted = new WeakMap<DefaultTreeAdapterMap["document"], Element[]>();

export function originalPageElement(element: Element): Element {
  return originals.get(element) ?? element;
}

export function pageTreeAdapter(): TreeAdapter<DefaultTreeAdapterMap> {
  const tokens = new WeakMap<Element["attrs"], Element>();
  const recipients: Element[] = [];
  return {
    ...defaultTreeAdapter,
    createDocument() {
      const document = defaultTreeAdapter.createDocument();
      adopted.set(document, recipients);
      return document;
    },
    createElement(tag, namespace, attrs) {
      const element = defaultTreeAdapter.createElement(tag, namespace, attrs);
      if (namespace === html.NS.HTML && formatting.has(tag)) {
        const original = tokens.get(attrs);
        if (original) originals.set(element, original);
        else tokens.set(attrs, element);
      }
      return element;
    },
    setNodeSourceCodeLocation(node, location) {
      defaultTreeAdapter.setNodeSourceCodeLocation(node, location);
      if ("tagName" in node && location && "attrs" in location)
        for (const attribute of node.attrs) {
          const span =
            location.attrs?.[
              attribute.prefix
                ? `${attribute.prefix}:${attribute.name}`
                : attribute.name
            ];
          if (span && !attributes.has(attribute))
            attributes.set(attribute, span);
        }
    },
    adoptAttributes(recipient, attrs) {
      const names = new Set(recipient.attrs.map(({ name }) => name));
      if (attrs.some(({ name }) => !names.has(name)))
        recipients.push(recipient);
      defaultTreeAdapter.adoptAttributes(recipient, attrs);
    },
  };
}

export function pageAttributeLocation(
  element: Element,
  attribute: Attribute,
): Location | undefined {
  const original = originalPageElement(element);
  const name = attribute.prefix
    ? `${attribute.prefix}:${attribute.name}`
    : attribute.name;
  return (
    attributes.get(attribute) ?? original.sourceCodeLocation?.attrs?.[name]
  );
}

export function recoverPageSourceLocations(
  source: string,
  document: DefaultTreeAdapterMap["document"],
): void {
  let recipients = adopted.get(document);
  if (!recipients) {
    recipients = [];
    const tokens = new WeakMap<Element["attrs"], Element>();
    const visit = (node: DefaultTreeAdapterMap["node"]) => {
      if ("tagName" in node) {
        if (node.sourceCodeLocation && formatting.has(node.tagName))
          tokens.set(node.attrs, node);
        if (
          node.tagName === "html" ||
          node.tagName === "body" ||
          formatting.has(node.tagName)
        )
          recipients!.push(node);
      }
      if ("childNodes" in node)
        for (const child of node.childNodes) visit(child);
      if ("content" in node) visit(node.content);
    };
    visit(document);
    for (const node of recipients) {
      const original = tokens.get(node.attrs);
      if (!node.sourceCodeLocation && original) originals.set(node, original);
    }
  }
  const missing = [...new Set(recipients)].filter((node) =>
    node.attrs.some((attribute) => !pageAttributeLocation(node, attribute)),
  );
  if (!missing.length) return;
  for (const { attribute, location } of rootAttributeLocations(
    source,
    document,
    missing,
  ))
    if (
      !missing.some(
        (node) =>
          node.attrs.includes(attribute) &&
          pageAttributeLocation(node, attribute),
      )
    )
      attributes.set(attribute, location);
}
