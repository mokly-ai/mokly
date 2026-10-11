import path from "node:path";

import { GENERATED_DIRECTORY, isSafeRepositoryPath } from "@mokly/viewer/data";
import type { HistoricalManifest } from "@mokly/viewer/data";

import { isInternalCatalogueFile } from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import { assetError } from "./asset_paths.js";

/** Decide membership before transport reads, using only this side's accepted inventory. */
export class AssetInventory {
  private readonly routes: ReadonlySet<string>;
  constructor(
    private readonly config: ResolvedConfig,
    manifest: HistoricalManifest,
    generated: Iterable<string> = manifest.generatedFiles.map(
      ({ path }) => path,
    ),
  ) {
    this.routes = new Set([
      ...[...generated].map((route) => `${GENERATED_DIRECTORY}/${route}`),
      ...manifest.assetClosure,
    ]);
  }

  has(route: string): boolean {
    assertInventoryPath(route, this.config);
    return this.routes.has(route);
  }
}

/** Unsafe paths and metadata never become optional counterpart absence. */
export function assertInventoryPath(
  route: string,
  config: ResolvedConfig,
): void {
  if (!isSafeRepositoryPath(route)) throw assetError(route, "unsafe path");
  if (
    isInternalCatalogueFile(
      path.resolve(config.mockupsDir, route),
      config,
      false,
    )
  )
    throw assetError(route, "targets internal catalogue metadata");
}

/** Keep ordinary reads strict while letting verification retain its missing-input context. */
export class MissingInventoryAsset extends MoklyError {
  constructor(
    readonly route: string,
    detail = "file is missing",
  ) {
    super(
      "review-invalid",
      `could not retain Review asset ${route}: ${detail}`,
    );
  }
}

/** Transport records must contain bytes; malformed records cannot imply deletion. */
export function inventoryBytes(route: string, value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array))
    throw assetError(route, "invalid resource bytes");
  return value;
}
