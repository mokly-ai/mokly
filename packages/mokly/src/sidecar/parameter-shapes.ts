import { protocol } from "./errors.js";

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown) =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
const stringMap = (value: unknown) =>
  record(value) &&
  Object.values(value).every((item) => typeof item === "string");

export function parameterShapes(params: Record<string, unknown>): void {
  if (
    params.renderer !== undefined &&
    params.renderer !== null &&
    typeof params.renderer !== "string"
  )
    protocol("renderer must be a string or null");
  if (
    params.slots !== undefined &&
    (!record(params.slots) ||
      Object.values(params.slots).some(
        (slot) =>
          !record(slot) ||
          Object.keys(slot).length !== 2 ||
          !(
            (slot.kind === "placeholder" && typeof slot.token === "string") ||
            (slot.kind === "saved" && typeof slot.handle === "string")
          ),
      ))
  )
    protocol("slots must contain tagged placeholders or saved handles");
  const binding = (value: unknown) =>
    record(value) &&
    Object.keys(value).length === 2 &&
    typeof value.path === "string" &&
    typeof value.title === "string";
  if (params.entry !== undefined && !binding(params.entry))
    protocol("entry must have path and title");
  if (
    params.entries !== undefined &&
    (!record(params.entries) || !Object.values(params.entries).every(binding))
  )
    protocol("entries must contain path and title bindings");
  if (
    params.classMaps !== undefined &&
    (!record(params.classMaps) ||
      Object.values(params.classMaps).some((map) => !stringMap(map)))
  )
    protocol("classMaps must contain string maps");
  if (record(params.moduleResolution)) {
    const resolution = params.moduleResolution;
    const maps = ["aliases", "loaders"];
    const lists = [
      "conditions",
      "mainFields",
      "packageRoots",
      "resolveExtensions",
    ];
    if (
      Object.keys(resolution).some(
        (key) => ![...maps, ...lists, "dependencyRoot"].includes(key),
      )
    )
      protocol("unknown moduleResolution field");
    if (
      resolution.dependencyRoot !== undefined &&
      typeof resolution.dependencyRoot !== "string"
    )
      protocol("dependencyRoot must be a string");
    for (const key of maps) {
      resolution[key] ??= {};
      if (!stringMap(resolution[key])) protocol(`${key} must be a string map`);
    }
    for (const key of lists) {
      resolution[key] ??= [];
      if (!strings(resolution[key])) protocol(`${key} must be a string array`);
    }
  }
}
