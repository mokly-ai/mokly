import path from "node:path";

export const assetExtensions = [
  ".avif",
  ".bmp",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
  ".eot",
  ".otf",
  ".ttf",
  ".woff",
  ".woff2",
  ".apng",
  ".cur",
  ".jfif",
  ".pjp",
  ".pjpeg",
  ".jxl",
  ".aac",
  ".flac",
  ".m4a",
  ".mov",
  ".mp3",
  ".mp4",
  ".ogg",
  ".opus",
  ".wav",
  ".webm",
  ".pdf",
  ".vtt",
  ".webmanifest",
] as const;

const extensions: ReadonlySet<string> = new Set(assetExtensions);
const assets = new WeakMap<ReadonlyMap<string, Uint8Array>, Set<string>>();

/** Consumer loaders match the longest configured filename suffix. */
export function consumerLoader(
  file: string,
  loaders: Readonly<Record<string, string>>,
): string | undefined {
  const suffix = Object.keys(loaders)
    .filter((key) => file.endsWith(key))
    .sort((left, right) => right.length - left.length)[0];
  return suffix === undefined ? undefined : loaders[suffix];
}

export function assetType(file: string): boolean {
  return extensions.has(path.extname(file));
}

/** Closed tokens retain their logical identity across byte edits and checkouts. */
export function assetToken(file: string): string {
  return `mokly-asset:[${file}]`;
}

/** Keep the actual asset-default loads with this compile's consumed-byte map. */
export function assetModule(
  file: string,
  files: ReadonlyMap<string, Uint8Array>,
): string {
  let paths = assets.get(files);
  if (!paths) {
    paths = new Set();
    assets.set(files, paths);
  }
  paths.add(file);
  return `export default ${JSON.stringify(assetToken(file))};`;
}

export function importedAssetPaths(
  files: ReadonlyMap<string, Uint8Array>,
): ReadonlySet<string> {
  return assets.get(files) ?? new Set();
}
