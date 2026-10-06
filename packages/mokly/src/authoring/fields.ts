import { UNKNOWN_FIELDS } from "./markers.js";

const common = [
  "dependencies",
  "description",
  "movedFrom",
  "path",
  "rationale",
  "relatedDocs",
  "slug",
  "tags",
  "title",
];
const screen = [
  ...common,
  "address",
  "colorSchemes",
  "desktop",
  "mobile",
  "useCasePaths",
];
const allowed = {
  folder: ["path", "title", "order", "hidden"],
  screen: [...screen, "variants"],
  "screen-variant": [...screen.filter((field) => field !== "path"), "variants"],
  page: [...common, "render"],
  "use-case": [...common, "steps"],
  "component-variant": ["slug", "movedFrom", "title", "description", "props"],
  component: [
    ...common,
    "propSchema",
    "slots",
    "controls",
    "render",
    "variants",
    "colorSchemes",
    "ownedDependencies",
  ],
};

/** Preserve unrecognized authoring keys even when flattening discards their values. */
export function unknownFields(
  input: object,
  kind: keyof typeof allowed,
): { readonly [UNKNOWN_FIELDS]: readonly string[] } {
  return {
    [UNKNOWN_FIELDS]: Object.keys(input).filter(
      (field) => !allowed[kind].includes(field),
    ),
  };
}

/** Copy declared inputs only, retaining every unknown key for registry diagnostics. */
export function authoredInput<T extends object>(
  input: T,
  kind: keyof typeof allowed,
): T & { readonly [UNKNOWN_FIELDS]: readonly string[] } {
  const declared = Object.fromEntries(
    Object.keys(input)
      .filter((key) => allowed[kind].includes(key))
      .map((key) => [key, (input as Record<string, unknown>)[key]] as const),
  ) as T;
  return { ...declared, ...unknownFields(input, kind) };
}
