import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { isInside } from "../config/paths.js";
import { privateStaticPathReason } from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

export function assertPublicStaticRoute(
  route: string,
  config: ResolvedConfig,
): string {
  if (!isSafeRepositoryPath(route)) throw assetError(route, "unsafe path");
  const candidate = path.resolve(config.mockupsDir, route);
  const denial = privateStaticPathReason(candidate, config, false);
  if (!isInside(config.mockupsDir, candidate) || denial) {
    throw assetError(
      route,
      `not a public static file${denial ? `: ${denial}` : ""}`,
    );
  }
  return candidate;
}

export function assetError(
  route: string,
  detail: string,
  cause?: unknown,
): MoklyError {
  return new MoklyError(
    "review-invalid",
    `could not retain Review asset ${route}: ${detail}`,
    cause === undefined ? undefined : { cause },
  );
}
