import type { ViewerManifest } from "./manifest.mjs";
export function verifyPackageVersions(
  root: string,
): Promise<{ cli: ViewerManifest; viewer: ViewerManifest }>;
