import { isDeepStrictEqual } from "node:util";

import { parse } from "parse5";

import { parseStaticDelivery, type StaticDelivery } from "@mokly/viewer/data";

import { exportError } from "./error.js";

/** Stable normalization of the one self-referential field during staging. */
export const STAGED_DEPLOYMENT_ID = "0".repeat(64);

/** Authenticated source ranges around one exporter-owned root descriptor. */
export interface ExportShellMetadata {
  readonly before: string;
  readonly after: string;
  readonly delivery: StaticDelivery;
}

/** Attach static routing only to the root of a trusted captured shell document. */
export function markCapturedShell(
  name: string,
  html: string,
  delivery: StaticDelivery,
): string {
  const document = parse(html, { sourceCodeLocationInfo: true });
  const root = document.childNodes.find((node) => node.nodeName === "html");
  if (!root || !("attrs" in root)) throw invalidShell(name);
  const start = root.sourceCodeLocation?.startTag?.startOffset;
  if (
    start === undefined ||
    html.slice(start, start + 5).toLowerCase() !== "<html" ||
    root.attrs.some((attr) =>
      ["data-mokly-static", "data-mokly-delivery"].includes(attr.name),
    )
  )
    throw invalidShell(name);
  return `${html.slice(0, start + 5)} data-mokly-static="" ${deliveryAttribute(delivery)}${html.slice(start + 5)}`;
}

/** Require adapters to preserve the original shell-owned routing contract. */
export function readExportShellMetadata(
  name: string,
  html: string,
  expected: StaticDelivery,
): ExportShellMetadata {
  const duplicates: number[] = [];
  const document = parse(html, {
    sourceCodeLocationInfo: true,
    onParseError: (error) => {
      if (error.code === "duplicate-attribute")
        duplicates.push(error.startOffset);
    },
  });
  const root = document.childNodes.find((node) => node.nodeName === "html");
  if (!root || !("attrs" in root)) throw invalidShell(name);
  const startTag = root.sourceCodeLocation?.startTag;
  const location = root.sourceCodeLocation?.attrs?.["data-mokly-delivery"];
  const raw = root.attrs.find(
    (attr) => attr.name === "data-mokly-delivery",
  )?.value;
  const mode = root.attrs.find(
    (attr) => attr.name === "data-mokly-static",
  )?.value;
  if (
    !startTag ||
    !location ||
    raw === undefined ||
    mode !== "" ||
    location.startOffset < startTag.startOffset ||
    location.endOffset > startTag.endOffset ||
    duplicates.some(
      (offset) => offset >= startTag.startOffset && offset < startTag.endOffset,
    )
  )
    throw invalidShell(name);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw invalidShell(name, error);
  }
  const delivery = parseStaticDelivery(value);
  if (!delivery || !isDeepStrictEqual(delivery, expected))
    throw invalidShell(name);
  return {
    before: html.slice(0, location.startOffset),
    after: html.slice(location.endOffset),
    delivery,
  };
}

/** Change only authenticated metadata, retaining every other adapter-written byte. */
export function stampExportShell(
  shell: ExportShellMetadata,
  deploymentId: string,
): string {
  return `${shell.before}${deliveryAttribute({ ...shell.delivery, deploymentId })}${shell.after}`;
}

function deliveryAttribute(delivery: StaticDelivery): string {
  const value = JSON.stringify(delivery)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return `data-mokly-delivery="${value}"`;
}

function invalidShell(name: string, cause?: unknown) {
  return exportError(
    `Invalid or changed static shell metadata: ${name}`,
    cause,
  );
}
