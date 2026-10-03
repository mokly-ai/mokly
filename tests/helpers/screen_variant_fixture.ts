import { componentEntrySource } from "./component_fixture.js";

interface ScreenVariantSourceOptions {
  flowScreenId?: "home" | "home-empty";
  includeParent?: boolean;
  includeVariant?: boolean;
  parentText?: string;
  parentTitle?: string;
  variantText?: string;
}

/** A minimal screen catalogue with one parent and an optional flattened variant. */
export function screenVariantEntrySource(
  options: ScreenVariantSourceOptions = {},
): string {
  const includeParent = options.includeParent ?? true;
  const includeVariant = includeParent && (options.includeVariant ?? true);
  const flowScreenId = options.flowScreenId;
  const variant = includeVariant
    ? `, variants: [{ id: "home-empty", title: "Home empty", description: "An empty home screen", mobile: <main>{${JSON.stringify(options.variantText ?? "Empty home")}}</main>, desktop: <main>{${JSON.stringify(options.variantText ?? "Empty home")}}</main>, useCaseIds: ${JSON.stringify(flowScreenId === "home-empty" ? ["variant-flow"] : [])} }]`
    : "";
  const parent = includeParent
    ? `defineScreen({ ...metadata, navPath: ["Fixture"], id: "home", title: ${JSON.stringify(options.parentTitle ?? "Home")}, description: "The home screen", mobile: <main>{${JSON.stringify(options.parentText ?? "Home")}}</main>, desktop: <main>{${JSON.stringify(options.parentText ?? "Home")}}</main>, useCaseIds: ${JSON.stringify(flowScreenId === "home" ? ["variant-flow"] : [])}${variant} }),`
    : "";
  const flow = flowScreenId
    ? `defineUseCase({ ...metadata, navPath: ["Fixture"], id: "variant-flow", title: "Variant flow", description: "A variant journey", steps: [{ screenId: ${JSON.stringify(flowScreenId)} }] }),`
    : "";
  return `import React from "react";
import { defineScreen${flowScreenId ? ", defineUseCase" : ""} } from "@mokly/mokly";
const metadata = { relatedDocs: ["notes.md"] };
export const mockups = [
  ${parent}
  defineScreen({ ...metadata, navPath: ["Fixture"], id: "details", title: "Details", description: "A detail screen", mobile: <main>Details</main>, desktop: <main>Details</main>, useCaseIds: [] }),
  ${flow}
];
`;
}

/** A component-aware catalogue whose screen variant is the sole screen consumer. */
export function componentScreenVariantEntrySource(
  options: {
    flow?: boolean;
    parentText?: string;
    variantText?: string;
  } = {},
): string {
  const flow = options.flow ?? false;
  const variant = `variants: [{ id: "home-empty", title: "Home empty", description: "An empty home screen", mobile: <main><span>{${JSON.stringify(options.variantText ?? "Empty home")}}</span><action.Component label="Variant action" /></main>, desktop: <main><span>{${JSON.stringify(options.variantText ?? "Empty home")}}</span><action.Component label="Variant action" /></main>, useCaseIds: ${JSON.stringify(flow ? ["variant-flow"] : [])} }],`;
  let source = componentEntrySource({
    body: `<p>{${JSON.stringify(options.parentText ?? "Home")}}</p>`,
  }).replace('id: "home",', `id: "home", ${variant}`);
  if (!flow) return source;
  source = source
    .replace(
      "defineComponent, defineScreen,",
      "defineComponent, defineScreen, defineUseCase,",
    )
    .replace(
      "\n];",
      ',\n  defineUseCase({ ...metadata, navPath: ["Fixture"], id: "variant-flow", title: "Variant flow", description: "A variant journey", steps: [{ screenId: "home-empty" }] })\n];',
    );
  return source;
}
