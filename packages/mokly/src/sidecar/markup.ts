import { parseFragment } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";

import type { RenderSession } from "../authoring/runtime.js";
import type { CollectedStyle } from "../generated/sidecar/CollectedStyle.js";
import type { MarkerDraft } from "../generated/sidecar/MarkerDraft.js";

import { uniqueMarkerIds } from "./marker-ids.js";
import { markerRecords } from "./markup-records.js";
import type { InlineAttribution } from "./style-ownership.js";

type Node = DefaultTreeAdapterMap["node"];

/** Authenticate generated boundaries before replacing them with inert comments. */
export function finishMarkup(
  html: string,
  session: RenderSession,
  extractStyles = true,
  inlineAttribution?: InlineAttribution,
): { html: string; styles: CollectedStyle[]; markers: MarkerDraft[] } {
  uniqueMarkerIds(session);
  const document = parseFragment(html, { sourceCodeLocationInfo: true });
  const replacements: { start: number; end: number; text: string }[] = [];
  const used = new Set<string>();
  const styles: CollectedStyle[] = [];
  const markers = markerRecords(session);
  function visit(node: Node) {
    if (
      node.nodeName === "#comment" &&
      "data" in node &&
      node.data.startsWith("mokly-")
    )
      throw new Error("consumer output contains a reserved mokly- comment");
    if ("tagName" in node && node.tagName.startsWith("mokly-")) {
      const authoredScope =
        !extractStyles &&
        ["mokly-ignore", "mokly-ignore-scope"].includes(node.tagName);
      if (node.tagName !== "mokly-slot" && !authoredScope)
        throw new Error("consumer output contains a reserved mokly- element");
      if (node.tagName === "mokly-slot") {
        const name = node.attrs.find(
          (attribute) => attribute.name === "name",
        )?.value;
        const token = node.attrs.find(
          (attribute) => attribute.name === "token",
        )?.value;
        if (!session.placeholders.has(JSON.stringify([name, token])))
          throw new Error("consumer output contains a forged slot placeholder");
      }
    }
    if ("attrs" in node) {
      for (const attribute of node.attrs) {
        if (!["href", "data-nav-href"].includes(attribute.name)) continue;
        const value = session.logicalLink(attribute.value);
        const location = node.sourceCodeLocation?.attrs?.[attribute.name];
        if (value !== attribute.value && location)
          replacements.push({
            start: location.startOffset,
            end: location.endOffset,
            text: `${attribute.name}="${value}"`,
          });
      }
      const token = node.attrs.find(
        (attribute) => attribute.name === "data-mokly-boundary",
      )?.value;
      if (token) {
        const comment = session.markers.get(token);
        if (!comment || used.has(token) || node.tagName !== "template")
          throw new Error("forged or duplicate Mokly marker");
        used.add(token);
        markers.add(comment);
        const location = node.sourceCodeLocation!;
        replacements.push({
          start: location.startOffset,
          end: location.endOffset,
          text: `<!--${comment}-->`,
        });
      }
    }
    if (extractStyles && "tagName" in node && node.tagName === "style") {
      const text = node.childNodes
        .map((child) => ("value" in child ? child.value : ""))
        .join("");
      const attribution = inlineAttribution?.(text, node.attrs);
      styles.push({
        css: text,
        owners: markers.owner(),
        ...(attribution ? { attribution } : {}),
      });
      const location = node.sourceCodeLocation!;
      replacements.push({
        start: location.startOffset,
        end: location.endOffset,
        text: "",
      });
      return;
    }
    if ("childNodes" in node) node.childNodes.forEach(visit);
    if ("content" in node) visit(node.content);
  }
  visit(document);
  if (used.size !== session.markers.size)
    throw new Error("render dropped a Mokly marker");
  markers.finish();
  for (const replacement of replacements.sort((a, b) => b.start - a.start))
    html =
      html.slice(0, replacement.start) +
      replacement.text +
      html.slice(replacement.end);
  return { html, styles, markers: markers.records };
}
