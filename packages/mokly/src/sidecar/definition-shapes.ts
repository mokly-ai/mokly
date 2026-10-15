import { definitionData } from "../authoring/runtime.js";
import type { DefinitionDiagnostic } from "../generated/sidecar/DefinitionDiagnostic.js";

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/** Validate transport field shapes. The Rust core owns schema interpretation. */
export function definitionShapes(
  input: Record<string, unknown>,
  kind: string,
  module: string,
  exportName: string,
  variant = false,
): DefinitionDiagnostic[] {
  const diagnostics: DefinitionDiagnostic[] = [];
  const add = (
    message: string,
    code: DefinitionDiagnostic["code"] = "invalid-definition",
  ) =>
    diagnostics.push({
      code: kind === "folder" ? "invalid-folder" : code,
      module,
      exportName,
      message,
    });
  const required = variant
    ? ["slug", "title"]
    : kind === "folder"
      ? ["path"]
      : ["title", "description"];
  for (const key of required)
    if (typeof input[key] !== "string") add(`${key} must be a string`);
  for (const key of [
    "slug",
    "path",
    "title",
    "description",
    "rationale",
    "movedFrom",
    "address",
  ])
    if (input[key] !== undefined && typeof input[key] !== "string")
      add(`${key} must be a string`);
  for (const key of ["relatedDocs", "tags", "stylesheets", "order", "slots"]) {
    if (key === "slots" && variant) continue;
    if (input[key] !== undefined && !strings(input[key]))
      add(
        `${key} must be a string array`,
        key === "slots" ? "component-slots" : "invalid-definition",
      );
  }
  if (!variant && kind !== "folder" && !strings(input.relatedDocs))
    add("relatedDocs must be a string array");
  if (
    input.colorSchemes !== undefined &&
    (!strings(input.colorSchemes) ||
      input.colorSchemes.some((scheme) => !["light", "dark"].includes(scheme)))
  )
    add("colorSchemes must contain light or dark");
  if (input.hidden !== undefined && typeof input.hidden !== "boolean")
    add("hidden must be boolean");
  if (input.element !== undefined && typeof input.element !== "string")
    add("element must be a string", "component-element");
  if (
    input.useCasePaths !== undefined &&
    (!Array.isArray(input.useCasePaths) ||
      input.useCasePaths.some(
        (value) => typeof value !== "string" && !definitionData(value),
      ))
  )
    add("useCasePaths must contain paths or definitions");
  if (
    kind === "useCase" &&
    (!Array.isArray(input.steps) ||
      input.steps.some(
        (step) =>
          !object(step) ||
          (typeof step.screenPath !== "string" &&
            !definitionData(step.screenPath)) ||
          (step.title !== undefined && typeof step.title !== "string") ||
          (step.description !== undefined &&
            typeof step.description !== "string"),
      ))
  )
    add("steps must contain screen references and optional text");
  if (variant && !object(input.props))
    add("variant props must be an object", "component-props");
  if (variant && input.slots !== undefined && !object(input.slots))
    add("variant slots must be an object", "component-slots");
  if (input.controls !== undefined) {
    if (!object(input.controls))
      add("controls must be an object", "component-controls");
    else
      for (const [name, control] of Object.entries(input.controls)) {
        if (
          !object(control) ||
          !["text", "boolean", "number", "select"].includes(
            String(control.kind),
          )
        ) {
          add(`control ${name} has an invalid kind`, "component-controls");
          continue;
        }
        if (
          ["label", "description"].some(
            (key) =>
              control[key] !== undefined && typeof control[key] !== "string",
          ) ||
          ["minimum", "maximum", "step", "maxLength"].some(
            (key) =>
              control[key] !== undefined &&
              (typeof control[key] !== "number" ||
                !Number.isFinite(control[key])),
          )
        )
          add(`control ${name} has invalid fields`, "component-controls");
        if (
          control.kind === "select" &&
          (!Array.isArray(control.options) ||
            control.options.some(
              (option) =>
                !object(option) ||
                typeof option.label !== "string" ||
                !(
                  option.value === null ||
                  ["string", "number", "boolean"].includes(typeof option.value)
                ),
            ))
        )
          add(`control ${name} has invalid options`, "component-controls");
      }
  }
  return diagnostics;
}
