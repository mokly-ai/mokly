import type { ManifestEntry } from "@mokly/viewer/data";

/** Synthetic manifest entries for the hydration shape tests. */
export type Screen = Extract<ManifestEntry, { kind: "screen" }>;
export type MarkdownDocument = Extract<ManifestEntry, { kind: "document" }>;
export type Component = Exclude<
  Extract<ManifestEntry, { kind: "component" }>,
  { variantOf: string }
>;
export type Variant = Extract<
  ManifestEntry,
  { kind: "component"; variantOf: string }
>;
export type View = Variant["componentViews"][number];
export type Instance = View["instances"][number];

const common = {
  declaredDependencies: [],
  description: "An entry",
  relatedDocs: [],
  sourcePath: "specs/entries.mockup.tsx",
};

/** A light-only screen with no use cases, components or tags. */
export function screen(path: string, extra: Partial<Screen> = {}): Screen {
  return {
    ...common,
    colorSchemes: ["light"],
    kind: "screen",
    path,
    title: "Screen",
    useCasePaths: [],
    ...extra,
  };
}

/** A light-only Markdown document whose present fields match `screen()`. */
export function markdownDocument(
  path: string,
  extra: Partial<MarkdownDocument> = {},
): MarkdownDocument {
  return {
    ...common,
    colorSchemes: ["light"],
    kind: "document",
    path,
    resources: [],
    title: "Document",
    ...extra,
  };
}

/** A light-only component with no controls, props or slots. */
export function component(
  path: string,
  extra: Partial<Component> = {},
): Component {
  return {
    ...common,
    colorSchemes: ["light"],
    controls: {},
    kind: "component",
    ownedDependencies: [],
    path,
    propSchema: { kind: "object", properties: {} },
    slots: [],
    title: "Component",
    ...extra,
  };
}

/** A light-only variant of `fx/component` with no props or views. */
export function variant(path: string, extra: Partial<Variant> = {}): Variant {
  return {
    ...common,
    colorSchemes: ["light"],
    componentViews: [],
    kind: "component",
    path,
    props: {},
    suppliedSlots: [],
    title: "Variant",
    variantOf: "fx/component",
    ...extra,
  };
}

/** One entry-owned instance of `fx/component` with no props. */
export function instance(extra: Partial<Instance> = {}): Instance {
  return {
    componentId: "fx/component",
    id: "one",
    key: "instance-key",
    order: 0,
    owner: { kind: "entry" },
    props: {},
    propsKey: "props-key",
    ...extra,
  };
}

/** One light mobile component view that holds `instances`. */
export function view(instances: readonly Instance[]): View {
  return {
    colorScheme: "light",
    instances,
    ranges: [],
    resources: [],
    slots: [],
    styles: [],
    viewport: "mobile",
  };
}

/** The same JSON value with the keys of every object in reverse order. */
export function reverseKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(reverseKeys) as T;
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, item]) => [key, reverseKeys(item)]),
  ) as T;
}
