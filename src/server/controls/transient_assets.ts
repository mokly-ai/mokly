/** Immutable resource closure for an edited document; all bytes remain in memory. */

import type { ComponentViewRecord, ComponentWireProps } from "@mokly/viewer";
import {
  generatedResourcePath,
  generatedResourceRoute,
  entryRoute,
  ComponentRenderError,
  generatedViews,
} from "@mokly/viewer/data";
import { createCatalogue } from "@mokly/viewer/server";

import { adaptBrowseDocument } from "../../browse/document_adapter.js";
import {
  generatedBytes,
  type GeneratedFile,
} from "../../build/generated_file.js";
import { isGeneratedRoute } from "../../build/styles/routes.js";
import { PublicFilePolicy } from "../../config/public_policy.js";
import type { ResolvedConfig } from "../../config/types.js";
import type { CatalogueMetadata } from "../../registry/catalogue_index.js";
import { referencedRoutes } from "../../review/asset_references.js";
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
  const generatedRoutes = new Set(
    manifest.entries.flatMap((entry) => [
      ...(entry.kind === "page" ? [entryRoute("page", entry.id)] : []),
      ...generatedViews(entry).map((view) => view.path),
    ]),
  );
  const files = new Map<string, RenderFile>();
  const policy = new PublicFilePolicy(config);
  const pending = [generatedResourcePath(route)];
  let size = 0;
  while (pending.length) {
    const current = pending.shift()!;
    if (files.has(current)) continue;
    const relative = generatedResourceRoute(current);
    const generated =
      relative === undefined
        ? undefined
        : (outputs.get(relative) ?? readGenerated?.(relative));
    if (generated === undefined && isGeneratedRoute(current))
      throw new ComponentRenderError(
        "render-failed",
        "Preview resource is unavailable; rebuild the catalogue and try again.",
      );
    const decision =
      generated === undefined ? policy.inspect(current) : undefined;
    let bytes =
      generated === undefined
        ? policy.read(current)
        : generatedBytes(generated);
    if (!bytes)
      throw new Error(
        `Preview resource is unavailable: ${current} (referenced by ${route}; ${decision?.kind === "private" ? decision.reason : "missing, non-regular, or outside mockupsDir"})`,
      );
    const type = contentType(current);
    const references = referencedRoutes(current, bytes, {
      resourceHints: false,
    });
    if (type.startsWith("text/html"))
      bytes = Buffer.from(
        rebaseTransientNavigation(
          adaptBrowseDocument(bytes.toString(), relative, catalogue),
          current,
          generatedRoutes,
        ),
      );
    size += bytes.byteLength;
    if (size > RENDER_BYTES)
      throw new ComponentRenderError(
        "render-failed",
        "The preview is too large. Reduce its content and try again.",
      );
    files.set(current, { type, bytes });
    for (const target of references) {
      if (!files.has(target) && !pending.includes(target)) pending.push(target);
    }
  }
  return files;
}
