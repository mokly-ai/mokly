import { SourceMap } from "node:module";
import path from "node:path";

export function viteConfigError(
  error: unknown,
  file: string,
  map?: SourceMap,
  offset = 0,
): unknown {
  if (!error || typeof error !== "object") return error;
  if ("id" in error && typeof error.id === "string") return error;
  let source = file;
  if ("errors" in error && Array.isArray(error.errors)) {
    const location: unknown = error.errors[0]?.location;
    if (
      location &&
      typeof location === "object" &&
      "file" in location &&
      typeof location.file === "string"
    )
      source = path.resolve(path.dirname(file), location.file);
  }
  if (map && "stack" in error && typeof error.stack === "string") {
    const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const position = new RegExp(`${escaped}:(\\d+):(\\d+)`).exec(error.stack);
    if (position) {
      const entry = map.findEntry(
        Number(position[1]) - 1 - offset,
        Number(position[2]) - 1,
      );
      if ("originalSource" in entry && entry.originalSource)
        source = entry.originalSource.startsWith("file:")
          ? entry.originalSource
          : path.resolve(path.dirname(file), entry.originalSource);
    }
  }
  return Object.assign(error, { id: source });
}

export function viteConfigMap(text: string): SourceMap {
  return new SourceMap(JSON.parse(text));
}
