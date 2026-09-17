/** Strict shared validation for private control edits, separate from renderer execution. */

import type { ComponentPropsData, PropValue } from "@mokly/viewer";
import {
  decodeProps,
  decodeValue,
  validateControlledValues,
  exactKeys,
  plainKeys,
  validateProps,
  ComponentRenderError,
  type ComponentRenderRequest,
  generatedViews,
} from "@mokly/viewer/data";

import type { CatalogueMetadata } from "../registry/catalogue_index.js";

export function validateRenderRequest(
  value: unknown,
  manifest: CatalogueMetadata,
  generation: string,
): {
  request: ComponentRenderRequest;
  props: ComponentPropsData;
} {
  try {
    exactKeys(
      value,
      [
        "componentId",
        "variantId",
        "viewport",
        "colorScheme",
        "generation",
        "pageId",
        "overrides",
      ],
      "Controls",
    );
    const item = value as unknown as ComponentRenderRequest;
    if (
      typeof item.componentId !== "string" ||
      typeof item.variantId !== "string" ||
      !["mobile", "desktop"].includes(item.viewport) ||
      !["light", "dark"].includes(item.colorScheme) ||
      typeof item.generation !== "string" ||
      typeof item.pageId !== "string" ||
      !/^[a-f0-9]{32}$/.test(item.pageId)
    )
      throw new ComponentRenderError(
        "invalid-input",
        "Choose a component, variant and view.",
      );
    if (item.generation !== generation)
      throw new ComponentRenderError(
        "stale-generation",
        "The catalogue changed. Reload to continue editing.",
      );
    const component = manifest.entries.find(
      (entry) => entry.kind === "component" && entry.id === item.componentId,
    );
    const variant =
      component?.kind === "component" &&
      component.variants.find((variant) => variant.id === item.variantId);
    if (component?.kind !== "component" || !variant)
      throw new ComponentRenderError(
        "unknown-entry",
        "This component or variant is unavailable.",
      );
    if (
      !generatedViews(component).some(
        (view) =>
          view.variantId === item.variantId &&
          view.viewport === item.viewport &&
          view.colorScheme === item.colorScheme,
      )
    )
      throw new ComponentRenderError(
        "invalid-input",
        "This view is unavailable for the selected variant.",
      );
    const props: Record<string, PropValue> = { ...decodeProps(variant.props) };
    for (const key of plainKeys(item.overrides, "Overrides")) {
      if (!Object.hasOwn(component.controls, key))
        throw new Error("Only declared controls can be edited.");
      const override = item.overrides[key]!;
      exactKeys(override, ["kind", "value"], key);
      if (
        override.kind === "unset" &&
        !Object.hasOwn(override, "value") &&
        component.propSchema.properties[key]?.optional
      )
        delete props[key];
      else if (override.kind === "set") {
        const value = decodeValue(override.value);
        if (value !== null && typeof value === "object")
          throw new Error("Choose a declared preset for complex values.");
        props[key] = value;
      } else throw new Error("Only optional props can be unset.");
    }
    const validated = validateProps(component.propSchema, props, "Controls");
    validateControlledValues(component.controls, validated, "Controls");
    return { request: item, props: validated };
  } catch (error) {
    if (error instanceof ComponentRenderError) throw error;
    throw new ComponentRenderError(
      "invalid-input",
      "Check the prop values and their allowed limits.",
    );
  }
}
