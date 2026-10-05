import { isDefinition } from "../authoring/identity.js";
import { COMPONENT_REGISTRATION } from "../authoring/markers.js";
import type { RegistryDefinition } from "../authoring/types.js";
import { MoklyError } from "../errors.js";

/** An exported definition with an exact export/array diagnostic location. */
export interface CollectedDefinition {
  definition: RegistryDefinition;
  location: string;
  exportName: string;
  modulePath: string;
}

/** Collect branded values from every export, preserving module export order. */
export function collectModuleExports(
  exports: Readonly<Record<string, unknown>>,
  modulePath: string,
): CollectedDefinition[] {
  const result: CollectedDefinition[] = [];
  const seen = new Set<RegistryDefinition>();
  const add = (item: CollectedDefinition): void => {
    if (!seen.has(item.definition)) {
      seen.add(item.definition);
      result.push(item);
    }
  };
  for (const [exportName, exported] of Object.entries(exports)) {
    const location = `${modulePath} export ${exportName}`;
    let value = exported;
    if (
      value !== null &&
      typeof value === "object" &&
      COMPONENT_REGISTRATION in value &&
      value[COMPONENT_REGISTRATION] === true &&
      "entries" in value
    )
      value = value.entries;
    if (Array.isArray(value)) {
      for (const [index, definition] of value.entries()) {
        if (Array.isArray(definition) && containsDefinition(definition))
          throw new MoklyError(
            "build-invalid",
            `[nested-array] ${location}[${index}]: nested arrays are not definitions`,
          );
        if (isDefinition(definition))
          add({
            definition,
            location: `${location}[${index}]`,
            exportName,
            modulePath,
          });
      }
    } else if (isDefinition(value))
      add({ definition: value, location, exportName, modulePath });
  }
  if (!result.length)
    throw new MoklyError(
      "build-invalid",
      `[empty-module] ${modulePath} exports no Mokly definition`,
    );
  return result;
}

/** Ignore nested tabular helper data while rejecting nested definition exports. */
function containsDefinition(
  values: readonly unknown[],
  seen = new Set<unknown>(),
): boolean {
  if (seen.has(values)) return false;
  seen.add(values);
  return values.some(
    (value) =>
      isDefinition(value) ||
      (value !== null &&
        typeof value === "object" &&
        COMPONENT_REGISTRATION in value &&
        value[COMPONENT_REGISTRATION] === true) ||
      (Array.isArray(value) && containsDefinition(value, seen)),
  );
}
