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
    ? `, variants: [{ id: "home-empty", slug: "empty", title: "Home empty", description: "An empty home screen", mobile: <main>{${JSON.stringify(options.variantText ?? "Empty home")}}</main>, desktop: <main>{${JSON.stringify(options.variantText ?? "Empty home")}}</main>, useCaseIds: ${JSON.stringify(flowScreenId === "home-empty" ? ["variant-flow"] : [])} }]`
    : "";
  const parent = includeParent
    ? `defineScreen({ ...metadata, navPath: ["Fixture"], id: "home", title: ${JSON.stringify(options.parentTitle ?? "Home")}, description: "The home screen", route: "screens/home.html", mobile: <main>{${JSON.stringify(options.parentText ?? "Home")}}</main>, desktop: <main>{${JSON.stringify(options.parentText ?? "Home")}}</main>, useCaseIds: ${JSON.stringify(flowScreenId === "home" ? ["variant-flow"] : [])}${variant} }),`
    : "";
  const flow = flowScreenId
    ? `defineUseCase({ ...metadata, navPath: ["Fixture"], id: "variant-flow", title: "Variant flow", description: "A variant journey", route: "user-flows/variant.html", steps: [{ screenId: ${JSON.stringify(flowScreenId)} }] }),`
    : "";
  return `import React from "react";
import { defineScreen${flowScreenId ? ", defineUseCase" : ""} } from "@mokly/mokly";
const metadata = { dependencies: ["notes.md"], relatedDocs: ["notes.md"] };
export const mockups = [
  ${parent}
  defineScreen({ ...metadata, navPath: ["Fixture"], id: "details", title: "Details", description: "A detail screen", route: "screens/details.html", mobile: <main>Details</main>, desktop: <main>Details</main>, useCaseIds: [] }),
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
  const variant = `variants: [{ id: "home-empty", slug: "empty", title: "Home empty", description: "An empty home screen", mobile: <main><span>{${JSON.stringify(options.variantText ?? "Empty home")}}</span><action.Component label="Variant action" /></main>, desktop: <main><span>{${JSON.stringify(options.variantText ?? "Empty home")}}</span><action.Component label="Variant action" /></main>, useCaseIds: ${JSON.stringify(flow ? ["variant-flow"] : [])} }],`;
  let source = componentEntrySource({
    body: `<p>{${JSON.stringify(options.parentText ?? "Home")}}</p>`,
  }).replace(
    'route: "screens/home.html", mobile:',
    `route: "screens/home.html", ${variant} mobile:`,
  );
  if (!flow) return source;
  source = source
    .replace(
      "defineComponent, defineScreen,",
      "defineComponent, defineScreen, defineUseCase,",
    )
    .replace(
      "\n];",
      ',\n  defineUseCase({ ...metadata, navPath: ["Fixture"], id: "variant-flow", title: "Variant flow", description: "A variant journey", route: "user-flows/variant.html", steps: [{ screenId: "home-empty" }] })\n];',
    );
  return source;
}
