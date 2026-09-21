/** Inert HTML transformation for one historical document presentation. */

import type { PreviewPresentation } from "./presentation.js";

/** Apply the contracted base and refresh edits, then serialize the document. */
export function presentPreviewDocument(
  doc: Document,
  snapshotAddress: string,
): PreviewPresentation {
  const consumerBase = doc.querySelector("base[href]")?.getAttribute("href");
  let effectiveBase = snapshotAddress;
  if (consumerBase !== null && consumerBase !== undefined) {
    try {
      effectiveBase = new URL(consumerBase, snapshotAddress).href;
    } catch {
      effectiveBase = snapshotAddress;
    }
  }
  for (const base of doc.querySelectorAll("base")) base.remove();
  for (const meta of doc.querySelectorAll("meta")) {
    const directive = meta.getAttribute("http-equiv");
    if (directive && asciiTrim(directive).toLowerCase() === "refresh")
      meta.remove();
  }
  const head = documentHead(doc);
  const base = doc.createElement("base");
  base.setAttribute("href", effectiveBase);
  head.insertBefore(base, head.firstChild);
  const element = doc.documentElement;
  if (!element) return unavailable();
  return {
    snapshotAddress,
    srcdoc: `${serializeDoctype(doc.doctype)}${element.outerHTML}`,
  };
}

function documentHead(doc: Document): HTMLHeadElement {
  if (doc.head) return doc.head;
  const root = doc.documentElement;
  if (!root) return unavailable();
  const head = doc.createElement("head");
  root.insertBefore(head, doc.body ?? root.firstChild);
  return head;
}

function asciiTrim(value: string): string {
  return value.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, "");
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

function unavailable(): never {
  throw new Error("The previous version is unavailable.");
}
