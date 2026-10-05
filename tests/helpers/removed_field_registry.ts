import { __attributeDefinition } from "../../dist/authoring/definitions.js";
import type { RegistryDefinition } from "../../dist/authoring/types.js";
import type { ResolvedConfig } from "../../dist/config/types.js";
import { collectModuleExports } from "../../dist/registry/export_collection.js";
import { prepareRegistry } from "../../dist/registry/prepare.js";

/** Attribute the real branded definitions before collecting their module exports. */
export function prepareWarningRegistry(
  definitions: readonly RegistryDefinition[],
  config: ResolvedConfig,
) {
  const source = "entries/fixture.mockup.tsx";
  return prepareRegistry(
    collectModuleExports(
      { default: __attributeDefinition(definitions, source) },
      source,
    ),
    config,
  );
}
