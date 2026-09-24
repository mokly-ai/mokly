/** Immutable resource closure for an edited document; all bytes remain in memory. */
import fs from "node:fs";
import path from "node:path";

import type { ComponentViewRecord, ComponentWireProps } from "@mokly/viewer";
import { ComponentRenderError, generatedViews } from "@mokly/viewer/data";
import { createCatalogue } from "@mokly/viewer/server";

import { adaptBrowseDocument } from "../../browse/document_adapter.js";
import {
  isPublicStaticFile,
  publicFileFailureReason,
} from "../../config/public_files.js";
import type { ResolvedConfig } from "../../config/types.js";
import type { CatalogueMetadata } from "../../registry/catalogue_index.js";
import { referencedRoutes } from "../../review/asset_references.js";
import { rebaseGeneratedSnapshotUrls } from "../../review/normalize_urls.js";
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
  const generatedRoutes = new Set(
    manifest.entries.flatMap((entry) => [
      ...(entry.kind === "page" ? [entry.route] : []),
      ...generatedViews(entry).map((view) => view.path),
    ]),
  );
  const layout = { prefix: ".generated", routes: generatedRoutes };
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
    const references = referencedRoutes(
      current,
      bytes,
      { resourceHints: false },
      layout,
    );
    if (type.startsWith("text/html"))
      bytes = Buffer.from(
        generated === undefined
          ? rebaseTransientNavigation(
              adaptBrowseDocument(bytes.toString(), current, catalogue),
              current,
              generatedRoutes,
            )
          : rebaseGeneratedSnapshotUrls(
              rebaseTransientNavigation(
                adaptBrowseDocument(bytes.toString(), current, catalogue),
                `.generated/${current}`,
                generatedRoutes,
              ),
              current,
              ".generated",
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
