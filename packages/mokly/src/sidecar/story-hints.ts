import type { Primitive } from "../generated/sidecar/Primitive.js";
import type { StoryHints } from "../generated/sidecar/StoryHints.js";

const primitive = (value: unknown): value is Primitive =>
  value === null ||
  typeof value === "string" ||
  typeof value === "boolean" ||
  (typeof value === "number" && Number.isFinite(value));

/** UI hints never validate args. Unsupported hints contribute no control field. */
export function storyHints(value: unknown): StoryHints {
  if (!value || typeof value !== "object") return {};
  const input = value as Record<string, unknown>;
  const output: StoryHints = {};
  const options: unknown[] | undefined = Array.isArray(input.options)
    ? Array.from(input.options)
    : undefined;
  if (options?.every(primitive)) output.options = options;
  if (typeof input.name === "string") output.name = input.name;
  if (typeof input.description === "string")
    output.description = input.description;
  if (input.control && typeof input.control === "object") {
    output.control = Object.fromEntries(
      Object.entries(input.control).filter(
        (entry): entry is [string, number] =>
          ["min", "max", "step"].includes(entry[0]) &&
          typeof entry[1] === "number" &&
          Number.isFinite(entry[1]),
      ),
    );
  }
  return output;
}
