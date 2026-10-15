import path from "node:path";

import type { Message } from "esbuild";

import { detail } from "./errors.js";
import { logical } from "./path-scope.js";

/** Present esbuild's structured messages without its count and plugin framing. */
export function bundleDetail(error: unknown, root: string): string {
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
      diagnostic(message, root),
      ...message.notes.map((note) => diagnostic(note, root)),
    ])
    .join("\n");
}

function diagnostic(
  message: Pick<Message, "text" | "location">,
  root: string,
): string {
  if (!message.location) return message.text;
  const { file, line, column } = message.location;
  const name = path.isAbsolute(file) ? logical(root, file) : file;
  return `${name}:${line}:${column + 1}: ${message.text}`;
}
