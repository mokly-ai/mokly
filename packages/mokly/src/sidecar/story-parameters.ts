/// <reference lib="es2024.string" />

import type { IgnoredParameter } from "../generated/sidecar/IgnoredParameter.js";

type Globals = Record<string, unknown>;

export function readStoryParameters(value: unknown) {
  const ignoredParameters: IgnoredParameter[] = [];
  const result = {
    viewports: new Map<string, Globals>(),
    colorSchemes: new Map<string, Globals>(),
    ignoredParameters,
  };
  if (value === undefined) return result;
  if (!isPlainObject(value)) {
    ignoredParameters.push({ path: "mokly", reason: "not-an-object" });
    return result;
  }

  for (const [field, mapping] of Object.entries(value)) {
    const path = `mokly.${field.toWellFormed()}`;
    if (field !== "viewports" && field !== "colorSchemes") {
      ignoredParameters.push({ path, reason: "unknown-field" });
      continue;
    }
    if (!isPlainObject(mapping)) {
      ignoredParameters.push({ path, reason: "not-an-object" });
      continue;
    }
    const names =
      field === "viewports" ? ["mobile", "desktop"] : ["light", "dark"];
    for (const [name, globals] of Object.entries(mapping)) {
      const valuePath = `${path}.${name.toWellFormed()}`;
      if (!names.includes(name)) {
        ignoredParameters.push({
          path: valuePath,
          reason:
            field === "viewports" ? "unknown-viewport" : "unknown-color-scheme",
        });
      } else if (!isPlainObject(globals)) {
        ignoredParameters.push({ path: valuePath, reason: "not-an-object" });
      } else {
        result[field].set(name, globals);
      }
    }
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
