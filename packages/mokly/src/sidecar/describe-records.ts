import { copyData } from "../authoring/data.js";
import { definitionData } from "../authoring/runtime.js";
import type { DefinitionData } from "../authoring/runtime.js";
import type { Definition } from "../generated/sidecar/Definition.js";
import type { EntryReference } from "../generated/sidecar/EntryReference.js";
import type { Variant } from "../generated/sidecar/Variant.js";

import type { Generation } from "./bundle.js";
import { dataProps, metadataFields } from "./definition-fields.js";
import { SidecarError } from "./errors.js";

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

export function serialize(
  generation: Generation,
  value: object,
  data: DefinitionData,
  invalidMetadata = false,
): Definition {
  const input = data.input;
  const record: Definition = {
    handle: generation.registrations.get(value)!.handle,
    relatedDocs: [],
    tags: [],
    props: {},
    excludedProps: [],
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
  record.props = invalidMetadata
    ? {}
    : (dataProps(
        input.props,
        Object.hasOwn(input, "propSchema"),
        record.handle.replace("#", " export "),
        generation.warnings,
        record.excludedProps,
      ) as Definition["props"]);
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
      const excludedProps: string[] = [];
      const output = {
        ...Object.fromEntries(
          Object.entries(metadata).filter(
            ([key]) =>
              ["slug", "title", "description", "tags", "movedFrom"].includes(
                key,
              ) ||
              (data.kind === "screen" &&
                [
                  "colorSchemes",
                  "address",
                  "rationale",
                  "relatedDocs",
                ].includes(key)),
          ),
        ),
        props: invalidMetadata
          ? {}
          : dataProps(
              variant.props,
              Object.hasOwn(input, "propSchema"),
              `${record.handle.replace("#", " export ")}/${variant.slug}`,
              generation.warnings,
              excludedProps,
            ),
        excludedProps,
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
