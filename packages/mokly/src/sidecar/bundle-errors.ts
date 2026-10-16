import path from "node:path";

import type { Message } from "esbuild";

import { detail } from "./errors.js";
import type { ModulePaths } from "./module-paths.js";
import { logical } from "./path-scope.js";

/** A synthetic wrapper's authored caller and wrapped library file. */
export interface VirtualOrigin {
  importer: string;
  wrapped: string;
}

/** Present esbuild's structured messages without its count and plugin framing. */
export function bundleDetail(
  error: unknown,
  root: string,
  origins: Map<string, VirtualOrigin> = new Map(),
  sources?: ModulePaths,
): string {
  if (
    !error ||
    typeof error !== "object" ||
    !("errors" in error) ||
    !Array.isArray(error.errors)
  )
    return detail(error);
  const messages = error.errors as Message[];
  if (!messages.length) return detail(error);
  return messages
    .flatMap((message) => [
      diagnostic(message, root, origins, sources),
      ...message.notes.map((note) => diagnostic(note, root, origins, sources)),
    ])
    .join("\n");
}

function diagnostic(
  message: Pick<Message, "text" | "location">,
  root: string,
  origins: Map<string, VirtualOrigin>,
  sources?: ModulePaths,
): string {
  let text = message.text;
  for (const [virtual, origin] of origins)
    text = text.replaceAll(virtual, sourceName(origin.wrapped, root, sources));
  if (!message.location) return text;
  const { file, line, column } = message.location;
  const origin = origins.get(file);
  if (origin) return `${sourceName(origin.importer, root, sources)}: ${text}`;
  const name = sourceName(file, root, sources);
  return `${name}:${line}:${column + 1}: ${text}`;
}

function sourceName(file: string, root: string, sources?: ModulePaths): string {
  if (!path.isAbsolute(file)) return file;
  if (!sources) return logical(root, file);
  try {
    return sources.name(file);
  } catch {
    return path.basename(file);
  }
}
