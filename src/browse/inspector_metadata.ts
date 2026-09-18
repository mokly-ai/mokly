import type { ComponentViewRecord } from "@mokly/viewer";
import type { HtmlSourceLocation } from "@mokly/viewer/data";
import {
  readMetadata,
  compactRanges,
  type LinkIdentity,
  BYTE_LIMIT,
} from "@mokly/viewer/runtime";

interface SourceNode {
  tagName?: string;
  childNodes?: readonly SourceNode[];
  sourceCodeLocation?: {
    startOffset?: number;
    startTag?: HtmlSourceLocation;
    endTag?: HtmlSourceLocation;
  } | null;
}

/** Keep inert publication nodes out of positional selectors on consumer body content. */
export function inspectorInsertion(
  nodes: readonly SourceNode[],
  contentLength: number,
  markup: string,
): HtmlSourceLocation & { value: string } {
  const head = nodes.find(
    (node) => node.tagName === "head",
  )?.sourceCodeLocation;
  const headOffset = head?.endTag?.startOffset ?? head?.startTag?.endOffset;
  const body = nodes.find((node) => node.tagName === "body");
  const root = nodes.find((node) => node.tagName === "html");
  const offset =
    headOffset ??
    body?.sourceCodeLocation?.startTag?.startOffset ??
    body?.childNodes?.[0]?.sourceCodeLocation?.startOffset ??
    root?.sourceCodeLocation?.startTag?.endOffset ??
    contentLength;
  return {
    startOffset: offset,
    endOffset: offset,
    value: headOffset === undefined ? `<head>${markup}</head>` : markup,
  };
}

/** Metadata and executable are separate: the map carries no consumer text or props. */
export function inspectorMarkup(
  usage: ComponentViewRecord | undefined,
  links: readonly LinkIdentity[],
): string {
  let json = JSON.stringify({
    ranges: compactRanges(usage?.ranges ?? []),
    links,
  });
  if (Buffer.byteLength(json) > BYTE_LIMIT || !readMetadata(json))
    json = JSON.stringify({ ranges: [], links: [], error: "limit" });
  const escaped = json.replace(
    /[<>&]/g,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
  return `<template data-mokly-inspector>${escaped}</template><script src="/__mokly/client/inspector.js" defer></script>`;
}
