/** Immutable resource closure for an edited document; all bytes remain in memory. */
import fs from "node:fs";
import path from "node:path";

import { adaptBrowseDocument } from "../../browse/document_adapter.js";
import type { ComponentViewRecord } from "../../components/manifest_types.js";
import type { ComponentWireProps } from "../../components/prop_types.js";
import { ComponentRenderError } from "../../components/render_types.js";
import { isSafeRepositoryPath } from "../../config/paths.js";
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
import { createCatalogue } from "../catalogue.js";
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
  outputs: ReadonlyMap<string, string>,
  manifest: CatalogueMetadata,
  config: ResolvedConfig,
  readGenerated?: (route: string) => string | undefined,
): ReadonlyMap<string, RenderFile> {
  const catalogue = createCatalogue(manifest);
  const files = new Map<string, RenderFile>();
  const pending = [route];
  let size = 0;
  while (pending.length) {
    const current = pending.shift()!;
    if (files.has(current)) continue;
    const generated = outputs.get(current) ?? readGenerated?.(current);
    const candidate = path.resolve(config.mockupsDir, current);
    if (generated === undefined && !isPublicStaticFile(candidate, config))
      throw new Error(
        `Preview resource is unavailable: ${current} (referenced by ${route}; ${publicFileFailureReason(candidate, config) ?? "missing, non-regular, or outside mockupsDir"})`,
      );
    let bytes =
      generated === undefined
        ? fs.readFileSync(candidate)
        : Buffer.from(generated);
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
      if (!value || /^(?:[a-z][a-z0-9+.-]*:|#|\?|\/)/i.test(value)) continue;
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
