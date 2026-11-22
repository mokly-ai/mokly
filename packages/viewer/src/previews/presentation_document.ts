/** Inert HTML transformation for one snapshot document presentation. */

import type { SnapshotPresentation } from "./presentation.js";
import { rewriteDocumentAddresses } from "./presentation_addresses.js";
import { resolvedAddress } from "./presentation_url.js";

const ELEMENT_NODE = 1;
const COMMENT_NODE = 8;
const DOCUMENT_TYPE_NODE = 10;

/** Resolve historical addresses and serialize the document for presentation. */
export function presentSnapshotDocument(
  doc: Document,
  snapshotAddress: string,
  parse: (source: string) => Document,
): SnapshotPresentation {
  if (!doc.documentElement)
    throw new Error("The snapshot document is unavailable.");
  prepareDocument(doc, snapshotAddress, parse);
  return {
    snapshotAddress,
    srcdoc: serializeDocument(doc),
  };
}

function prepareDocument(
  doc: Document,
  fallback: string,
  parse: (source: string) => Document,
  embedded = false,
): boolean {
  const href = doc.querySelector("base[href]")?.getAttribute("href");
  const base =
    href == null ? fallback : (resolvedAddress(href, fallback) ?? fallback);
  return rewriteDocumentAddresses(doc, {
    base,
    embedded,
    transformSrcdoc(source) {
      const child = parse(source);
      return prepareDocument(child, base, parse, true)
        ? serializeDocument(child)
        : source;
    },
  });
}

function serializeDocument(doc: Document): string {
  return Array.from(doc.childNodes, (node) => {
    if (node.nodeType === DOCUMENT_TYPE_NODE)
      return serializeDoctype(node as DocumentType);
    if (node.nodeType === COMMENT_NODE)
      return `<!--${(node as Comment).data}-->`;
    if (node.nodeType === ELEMENT_NODE) return (node as Element).outerHTML;
    return "";
  }).join("");
}

function serializeDoctype(doctype: DocumentType | null): string {
  if (!doctype) return "";
  if (doctype.publicId)
    return `<!DOCTYPE ${doctype.name} PUBLIC ${quoted(doctype.publicId)}${
      doctype.systemId ? ` ${quoted(doctype.systemId)}` : ""
    }>`;
  if (doctype.systemId)
    return `<!DOCTYPE ${doctype.name} SYSTEM ${quoted(doctype.systemId)}>`;
  return `<!DOCTYPE ${doctype.name}>`;
}

function quoted(value: string): string {
  return value.includes('"') ? `'${value}'` : `"${value}"`;
}
