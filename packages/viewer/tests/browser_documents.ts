import fs from "node:fs/promises";
import path from "node:path";

import { parse, serialize } from "parse5";

import type { CatalogueUsage } from "../src/catalogue/types.js";
import type { ComponentViewRecord } from "../src/components/manifest_types.js";
import { compactRanges, type LinkIdentity } from "../src/inspector/metadata.js";

/** Supply the optional published inspector on this fixture's second origin. */
export function inspectorDocument(html: string, usage: CatalogueUsage): string {
  const document = parse(html);
  const links: LinkIdentity[] = [];
  const walk = (
    node: typeof document | (typeof document.childNodes)[number],
  ): void => {
    if ("attrs" in node) {
      const logical = node.attrs.find(
        (attr) => attr.name === "data-mokly-link",
      )?.value;
      if (logical) {
        const [screenPath, fragment] = logical.split("#");
        node.attrs.push({
          name: "data-mokly-inspector-link",
          value: String(links.length),
        });
        const name = node.attrs.find((attr) => attr.name === "target")?.value;
        const kind =
          name === "_top"
            ? "top"
            : name === "_parent"
              ? "parent"
              : name === "_blank"
                ? "blank"
                : "self";
        const target: LinkIdentity["target"] =
          name && !["_top", "_parent", "_blank", "_self"].includes(name)
            ? { kind: "named", name }
            : { kind };
        links.push({
          screenPath: screenPath!,
          ...(fragment ? { fragment } : {}),
          target,
        });
      }
    }
    if ("childNodes" in node) for (const child of node.childNodes) walk(child);
  };
  walk(document);
  const metadata = {
    ranges: usage.status === "ready" ? compactRanges(usage.ranges) : [],
    links,
    ...(usage.status === "ready" ? {} : { error: "unavailable" }),
  };
  return serialize(document).replace(
    "</body>",
    `<template data-mokly-inspector>${JSON.stringify(metadata).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</template><script src="/mokly-viewer/client/inspector.js"></script></body>`,
  );
}

export async function writeBrowserFile(
  root: string,
  name: string,
  bytes: string | Uint8Array,
) {
  const target = path.join(root, name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
}

export type BrowserUsage = Extract<CatalogueUsage, { status: "ready" }> &
  ComponentViewRecord;
