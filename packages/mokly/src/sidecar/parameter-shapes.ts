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
  if (params.slots !== undefined && !stringMap(params.slots))
    protocol("slots must map names to string tokens");
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
      Object.keys(resolution).some((key) => ![...maps, ...lists].includes(key))
    )
      protocol("unknown moduleResolution field");
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
