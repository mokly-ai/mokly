import { brand, definitionData } from "../authoring/runtime.js";
import type { DefinitionData } from "../authoring/runtime.js";
import type { Definitions } from "../generated/sidecar/Definitions.js";

import type { Generation } from "./bundle.js";
import { containsDefinition } from "./definition-arrays.js";
import { validateFields } from "./definition-fields.js";
import { serialize } from "./describe-records.js";
import { SidecarError, detail } from "./errors.js";
import { evaluate } from "./evaluate.js";
import { orderedExports } from "./export-order.js";
import { describeStories } from "./stories.js";

const groups = {
  screen: "screens",
  component: "components",
  page: "pages",
  useCase: "useCases",
  folder: "folders",
} as const;

export async function describe(generation: Generation): Promise<Definitions> {
  try {
    return await collect(generation);
  } catch (error) {
    if (error instanceof SidecarError) throw error;
    throw new SidecarError(
      "bundle-failed",
      `${generation.params.entryFiles.concat(generation.params.storiesFiles).join(", ")}: ${detail(error)}`,
    );
  }
}

async function collect(generation: Generation): Promise<Definitions> {
  if (generation.definitions) return generation.definitions;
  const exports = evaluate(generation);
  const result: Definitions = {
    screens: [],
    components: [],
    pages: [],
    useCases: [],
    folders: [],
    stories: [],
    diagnostics: [],
    warnings: generation.warnings,
  };
  const collected: {
    value: object;
    data: DefinitionData;
    module: string;
    exportName: string;
  }[] = [];
  const seen = new Map<object, string>();
  for (const [module, values] of Object.entries(exports.entries).sort(
    ([a], [b]) => (a < b ? -1 : 1),
  )) {
    let count = 0;
    for (const [exportName, value] of orderedExports(
      generation.sources.get(module) ?? "",
      values,
      module,
    )) {
      const location = `${module} export ${exportName}`;
      if (containsDefinition(value)) {
        result.diagnostics.push({
          code: "array-export",
          module,
          exportName,
          message: `${location}: export ${exportName} is an array; export one definition per export`,
        });
        continue;
      }
      const data = definitionData(value);
      if (!data) {
        if (
          value &&
          (typeof value === "object" || typeof value === "function") &&
          brand in value
        )
          result.diagnostics.push({
            code: "invalid-definition",
            module,
            exportName,
            message: `${location}: export ${exportName} is not a Mokly definition`,
          });
        continue;
      }
      count += 1;
      if (seen.has(value as object)) {
        const previous = seen.get(value as object)!;
        if (!previous.startsWith(`${module} export `))
          result.diagnostics.push({
            code: "duplicate-export",
            module,
            exportName,
            message: `definition ${data.input.title} is exported by two entry modules:\n${[
              previous,
              location,
            ]
              .sort()
              .map((item) => `  ${item}`)
              .join("\n")}`,
          });
        continue;
      }
      seen.set(value as object, location);
      const handle = `${module}#${exportName}`;
      generation.handles.set(handle, value as object);
      generation.registrations.set(value as object, {
        handle,
      });
      collected.push({ value: value as object, data, module, exportName });
    }
    if (!count)
      result.diagnostics.push({
        code: "empty-module",
        module,
        message: `${module} exports no Mokly definition`,
      });
  }
  for (const { value, data, module, exportName } of collected) {
    const diagnostics = validateFields(data, module, exportName);
    result.diagnostics.push(...diagnostics);
    if (
      diagnostics.some(
        (diagnostic) =>
          diagnostic.code !== "invalid-field" &&
          !(
            diagnostic.code === "invalid-variants" &&
            diagnostic.message === "a variant cannot declare variants"
          ),
      )
    )
      continue;
    try {
      const record = serialize(generation, value, data, diagnostics.length > 0);
      result[groups[data.kind as keyof typeof groups]].push(record);
    } catch (error) {
      result.diagnostics.push({
        code:
          error instanceof SidecarError
            ? (error.code as "component-props")
            : "component-props",
        module,
        exportName,
        message: detail(error),
      });
    }
  }
  for (const deferred of generation.runtime.links.values()) {
    if (
      typeof deferred.target !== "object" ||
      !deferred.target ||
      generation.registrations.has(deferred.target)
    )
      continue;
    const target = definitionData(deferred.target);
    result.diagnostics.push({
      code: "unknown-link-definition",
      module: deferred.source ?? "unknown module",
      message: `${deferred.source ?? "unknown module"}: referenced definition ${target?.input.title ?? "unknown"} from ${target?.source ?? "unknown module"} is not exported by an entry module`,
    });
  }
  await describeStories(generation, exports, result);
  generation.sources.clear();
  return (generation.definitions = result);
}
