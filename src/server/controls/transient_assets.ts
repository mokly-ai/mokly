/** Immutable resource closure for an edited document; all bytes remain in memory. */
import fs from "node:fs";
import path from "node:path";

import type { ComponentViewRecord, ComponentWireProps } from "@mokly/viewer";
import { ComponentRenderError, isSafeRepositoryPath } from "@mokly/viewer/data";
import { createCatalogue } from "@mokly/viewer/server";

import { adaptBrowseDocument } from "../../browse/document_adapter.js";
import {
  generatedBytes,
  type GeneratedFile,
} from "../../build/generated_file.js";
import { isGeneratedRoute } from "../../build/styles/routes.js";
import {
  isPublicStaticFile,
  publicFileFailureReason,
} from "../../config/public_files.js";
import type { ResolvedConfig } from "../../config/types.js";
import {
  extractCssReferences,
  extractHtmlReferences,
} from "../../html_references.js";
import type { CatalogueMetadata } from "../../registry/catalogue_index.js";
import { classifyResourceUrl } from "../../resource_url.js";
import { contentType } from "../respond.js";

import { rebaseTransientNavigation } from "./transient_links.js";

export const RENDER_BYTES = 32 * 1024 * 1024;
export interface RenderFile {
  type: string;
  bytes: Uint8Array;
}
export interface TransientRender {
  route: string;
  props: ComponentWireProps;
  view: ComponentViewRecord;
  files: ReadonlyMap<string, RenderFile>;
}
export function captureRenderBundle(
  route: string,
  outputs: ReadonlyMap<string, GeneratedFile>,
  manifest: CatalogueMetadata,
  config: ResolvedConfig,
  readGenerated?: (route: string) => GeneratedFile | undefined,
): ReadonlyMap<string, RenderFile> {
  const catalogue = createCatalogue(manifest);
  const files = new Map<string, RenderFile>();
  const pending = [route];
  let size = 0;
  while (pending.length) {
    const current = pending.shift()!;
    if (files.has(current)) continue;
    const generated = outputs.get(current) ?? readGenerated?.(current);
    if (generated === undefined && isGeneratedRoute(current))
      throw new ComponentRenderError(
        "render-failed",
        "Preview resource is unavailable; rebuild the catalogue and try again.",
      );
    const candidate = path.resolve(config.mockupsDir, current);
    if (generated === undefined && !isPublicStaticFile(candidate, config))
      throw new Error(
        `Preview resource is unavailable: ${current} (referenced by ${route}; ${publicFileFailureReason(candidate, config) ?? "missing, non-regular, or outside mockupsDir"})`,
      );
    let bytes =
      generated === undefined
        ? fs.readFileSync(candidate)
        : generatedBytes(generated);
    const type = contentType(current);
    const references = type.startsWith("text/html")
      ? extractHtmlReferences(bytes.toString()).resources
      : type.startsWith("text/css")
        ? extractCssReferences(bytes.toString())
        : [];
    if (type.startsWith("text/html"))
      bytes = Buffer.from(
        rebaseTransientNavigation(
          adaptBrowseDocument(bytes.toString(), current, catalogue),
          current,
        ),
      );
    size += bytes.byteLength;
    if (size > RENDER_BYTES)
      throw new ComponentRenderError(
        "render-failed",
        "The preview is too large. Reduce its content and try again.",
      );
    files.set(current, { type, bytes });
    for (const reference of references) {
      const value = reference;
      const classification = classifyResourceUrl(
        value,
        type.startsWith("text/css") ? "css" : "html",
      );
      if (
        classification.kind === "external" ||
        value.startsWith("#") ||
        value.startsWith("?")
      )
        continue;
      if (classification.kind === "invalid")
        throw new Error(`Preview resource has a non-portable URL: ${value}`);
      const pathname = decodeURIComponent(value.split(/[?#]/, 1)[0]!);
      const target = path.posix.normalize(
        path.posix.join(path.posix.dirname(current), pathname),
      );
      if (!isSafeRepositoryPath(target))
        throw new Error("Preview resource escapes its bundle");
      if (!files.has(target) && !pending.includes(target)) pending.push(target);
    }
  }
  return files;
}
