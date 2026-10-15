import { copyData } from "../authoring/data.js";
import { brand, definitionData } from "../authoring/runtime.js";
import type { DefinitionData } from "../authoring/runtime.js";
import type { Definition } from "../generated/sidecar/Definition.js";
import type { Definitions } from "../generated/sidecar/Definitions.js";
import type { EntryReference } from "../generated/sidecar/EntryReference.js";
import type { Variant } from "../generated/sidecar/Variant.js";

import type { Generation } from "./bundle.js";
import {
  dataProps,
  metadataFields,
  validateFields,
} from "./definition-fields.js";
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
      if (Array.isArray(value) && value.some((item) => definitionData(item))) {
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
    if (diagnostics.length) continue;
    try {
      const record = serialize(generation, value, data);
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

function reference(
  generation: Generation,
  value: unknown,
  location: string,
): EntryReference {
  if (typeof value === "string") return value;
  const registered =
    value && typeof value === "object"
      ? generation.registrations.get(value)
      : undefined;
  if (!registered) {
    const data = definitionData(value);
    throw new SidecarError(
      "unknown-link-definition",
      `${location}: referenced definition ${data?.input.title ?? "unknown"} from ${data?.source ?? "unknown module"} is not exported by an entry module`,
    );
  }
  return { handle: registered.handle };
}

function serialize(
  generation: Generation,
  value: object,
  data: DefinitionData,
): Definition {
  const input = data.input;
  const record: Definition = {
    handle: generation.registrations.get(value)!.handle,
    relatedDocs: [],
    tags: [],
    props: {},
    variants: [],
    slots: [],
    stylesheets: [],
    useCasePaths: [],
    steps: [],
  };
  if (data.source) record.sourcePath = data.source;
  for (const key of metadataFields)
    if (input[key] !== undefined)
      Object.assign(record, { [key]: copyData(input[key], true) });
  if (Object.hasOwn(input, "propSchema"))
    record.propSchema = copyData(input.propSchema, true) as NonNullable<
      Definition["propSchema"]
    >;
  record.props = dataProps(
    input.props,
    Object.hasOwn(input, "propSchema"),
    record.handle,
    generation.warnings,
  ) as Definition["props"];
  record.useCasePaths = ((input.useCasePaths ?? []) as unknown[]).map((item) =>
    reference(generation, item, record.handle.replace("#", " export ")),
  );
  record.steps = ((input.steps ?? []) as Record<string, unknown>[]).map(
    (step) => ({
      screenPath: reference(
        generation,
        step.screenPath,
        record.handle.replace("#", " export "),
      ),
      ...(step.title !== undefined ? { title: step.title as string } : {}),
      ...(step.description !== undefined
        ? { description: step.description as string }
        : {}),
    }),
  );
  record.variants = (Array.isArray(input.variants) ? input.variants : []).map(
    (variant, index) => {
      const { slots, useCasePaths, ...metadata } = variant;
      const output = {
        ...metadata,
        props: dataProps(
          variant.props,
          Object.hasOwn(input, "propSchema"),
          `${record.handle}/${variant.slug}`,
          generation.warnings,
        ),
        slots: {},
      } as Variant;
      if (useCasePaths)
        output.useCasePaths = useCasePaths.map((item: unknown) =>
          reference(generation, item, record.handle.replace("#", " export ")),
        );
      for (const [name, node] of Object.entries(slots ?? {})) {
        const handle = `${record.handle}:slot:${index}:${name}`;
        generation.savedSlots.set(handle, node);
        output.slots[name] = handle;
      }
      return output;
    },
  );
  return record;
}
