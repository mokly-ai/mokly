import { parse, type DefaultTreeAdapterMap } from "parse5";

import type { RemovedEntryPreview } from "@mokly/viewer";
import {
  catalogueViewHref,
  type ManifestPage,
  type ManifestScreen,
} from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";
import type { RemovedEntrySnapshot } from "../registry/changes.js";

const PREVIEW_ATTRIBUTE = "data-mokly-preview";

/** Inject a descriptor only when this captured shell owns the removed route. */
export function advertisePublicationShell(
  name: string,
  html: string,
  canonicalPath: string,
  removed: readonly RemovedEntrySnapshot["entry"][],
  previews: ReadonlyMap<string, RemovedEntryPreview> | undefined,
): string {
  if (!previews) return html;
  const entry = removed.find(
    (candidate) => catalogueViewHref(candidate.route) === canonicalPath,
  );
  if (!entry || (entry.kind !== "page" && entry.kind !== "screen")) return html;
  const published = previews.get(entry.route);
  return published
    ? advertisePublicationPreview(name, html, entry, published)
    : html;
}

/** Add one validated packaged descriptor to a captured removed-entry shell. */
export function advertisePublicationPreview(
  name: string,
  html: string,
  entry: ManifestPage | ManifestScreen,
  published: RemovedEntryPreview,
): string {
  const duplicateOffsets: number[] = [];
  const document = parse(html, {
    sourceCodeLocationInfo: true,
    onParseError: (error) => {
      if (error.code === "duplicate-attribute")
        duplicateOffsets.push(error.startOffset);
    },
  });
  const elements = previewElements(document);
  if (elements.length !== 1) throw invalidShell(name);
  const element = elements[0]!;
  const location = element.sourceCodeLocation?.attrs?.[PREVIEW_ATTRIBUTE];
  const value = element.attrs.find(
    (attribute) => attribute.name === PREVIEW_ATTRIBUTE,
  )?.value;
  if (
    !location ||
    value === undefined ||
    duplicateOffsets.some(
      (offset) => offset >= location.startOffset && offset < location.endOffset,
    )
  )
    throw invalidShell(name);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (cause) {
    throw invalidShell(name, cause);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw invalidShell(name);
  const descriptor = parsed as Record<string, unknown>;
  if (
    descriptor["id"] !== entry.id ||
    descriptor["kind"] !== entry.kind ||
    descriptor["route"] !== entry.route ||
    (published.kind === "screen" && entry.kind !== "screen") ||
    (published.kind === "page" && entry.kind !== "page")
  )
    throw invalidShell(name);
  const replacement = attribute({ ...descriptor, published });
  return `${html.slice(0, location.startOffset)}${replacement}${html.slice(location.endOffset)}`;
}

function previewElements(
  node: DefaultTreeAdapterMap["node"],
): DefaultTreeAdapterMap["element"][] {
  const found: DefaultTreeAdapterMap["element"][] = [];
  if (
    "attrs" in node &&
    node.attrs.some((candidate) => candidate.name === PREVIEW_ATTRIBUTE)
  )
    found.push(node);
  if ("childNodes" in node)
    for (const child of node.childNodes) found.push(...previewElements(child));
  return found;
}

function attribute(value: unknown): string {
  const encoded = JSON.stringify(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return `${PREVIEW_ATTRIBUTE}="${encoded}"`;
}

function invalidShell(name: string, cause?: unknown): MoklyError {
  return new MoklyError(
    "export-invalid",
    `Invalid or changed removed-preview shell metadata: ${name}`,
    { cause },
  );
}
