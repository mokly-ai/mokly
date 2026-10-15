import { copyData } from "../authoring/data.js";
import type { DefinitionData } from "../authoring/runtime.js";
import type { DefinitionDiagnostic } from "../generated/sidecar/DefinitionDiagnostic.js";
import type { Warning } from "../generated/sidecar/Warning.js";

import { definitionShapes } from "./definition-shapes.js";
import { SidecarError, detail } from "./errors.js";

const common = [
  "title",
  "description",
  "relatedDocs",
  "slug",
  "path",
  "movedFrom",
  "rationale",
  "tags",
];
const fields: Record<string, string[]> = {
  screen: [
    ...common,
    "propSchema",
    "props",
    "render",
    "variants",
    "controls",
    "colorSchemes",
    "address",
    "useCasePaths",
  ],
  component: [
    ...common,
    "propSchema",
    "props",
    "render",
    "variants",
    "controls",
    "colorSchemes",
    "element",
    "slots",
    "stylesheets",
  ],
  page: [...common, "render"],
  useCase: [...common, "steps"],
  folder: ["path", "title", "order", "hidden"],
};
export const metadataFields = [
  "title",
  "description",
  "relatedDocs",
  "slug",
  "path",
  "movedFrom",
  "rationale",
  "tags",
  "colorSchemes",
  "address",
  "controls",
  "element",
  "slots",
  "stylesheets",
  "order",
  "hidden",
] as const;

export function validateFields(
  data: DefinitionData,
  module: string,
  exportName: string,
): DefinitionDiagnostic[] {
  const output = definitionShapes(data.input, data.kind, module, exportName);
  const input = data.input;
  const add = (code: DefinitionDiagnostic["code"], message: string) =>
    output.push({
      code,
      module,
      exportName,
      message:
        code === "invalid-definition"
          ? `${module} export ${exportName}: export ${exportName} is not a Mokly definition: ${message}`
          : message,
    });
  for (const key of Object.keys(input))
    if (!fields[data.kind]!.includes(key))
      add(
        data.kind === "folder" ? "invalid-folder" : "invalid-field",
        `unknown field ${key}`,
      );
  if (
    data.kind !== "folder" &&
    data.kind !== "useCase" &&
    typeof input.render !== "function"
  )
    add("invalid-definition", "render must be a function");
  const variants = input.variants;
  if (variants !== undefined && !Array.isArray(variants))
    add("invalid-variants", "variants must be an array");
  if (Array.isArray(variants))
    for (const value of variants) {
      if (!value || typeof value !== "object") {
        add("invalid-variants", "a variant must be an object");
        continue;
      }
      const variant = value as Record<string, unknown>;
      output.push(
        ...definitionShapes(variant, data.kind, module, exportName, true),
      );
      for (const key of Object.keys(variant)) {
        if (key === "variants")
          add("invalid-variants", "a variant cannot declare variants");
        else if (
          !(
            data.kind === "screen"
              ? [
                  "slug",
                  "title",
                  "props",
                  "description",
                  "tags",
                  "movedFrom",
                  "colorSchemes",
                  "address",
                  "rationale",
                  "relatedDocs",
                  "useCasePaths",
                ]
              : [
                  "slug",
                  "title",
                  "props",
                  "description",
                  "tags",
                  "movedFrom",
                  "slots",
                ]
          ).includes(key)
        )
          add("invalid-field", `unknown field ${key}`);
      }
      if (
        typeof variant.slug !== "string" ||
        !/^[A-Za-z0-9_-]+$/.test(variant.slug)
      )
        add("invalid-variants", "a variant must declare a valid slug");
    }
  if (Array.isArray(input.steps))
    input.steps.forEach((value, index) => {
      if (!value || typeof value !== "object") return;
      for (const key of Object.keys(value))
        if (!["screenPath", "title", "description"].includes(key))
          add("invalid-field", `step #${index + 1}: unknown field ${key}`);
    });
  return output;
}

export function dataProps(
  input: unknown,
  declared: boolean,
  location: string,
  warnings: Warning[],
): Record<string, unknown> {
  if (input === undefined) return {};
  if (declared) {
    try {
      const copied = copyData(input);
      if (!copied || typeof copied !== "object" || Array.isArray(copied))
        throw new Error("props must be an object");
      return copied as Record<string, unknown>;
    } catch (error) {
      throw new SidecarError(
        "component-props",
        `${location}: ${detail(error)}`,
      );
    }
  }
  const output: Record<string, unknown> = Object.create(null);
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("props must be an object");
  for (const [key, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(input),
  )) {
    try {
      if (!("value" in descriptor) || !descriptor.enumerable)
        throw new Error("accessor is not data");
      output[key] = copyData(descriptor.value);
    } catch {
      warnings.push({
        code: "props-not-data",
        message: `${location}: prop ${key} is not plain data`,
      });
    }
  }
  return output;
}
