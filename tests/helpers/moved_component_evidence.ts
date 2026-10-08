/** Served evidence for a component library that moved from `components` to `ui`. */

import type { ManifestEntry } from "../../packages/viewer/dist/registry/types.js";
import type {
  ChangedEntry,
  ComponentVariantReview,
  EntryChangeReason,
  ReviewResultV7,
} from "../../packages/viewer/dist/review/component_types.js";
import {
  createCatalogue,
  type Catalogue,
} from "../../packages/viewer/dist/shell/catalogue.js";
import type { ShellContext } from "../../packages/viewer/dist/shell/context.js";

import { currentManifest } from "./current_manifest.js";

/** Light views whose entry supplies a glyph Icon named `name`. */
function iconViews(componentId: string, name: string) {
  return (["mobile", "desktop"] as const).map((viewport) => ({
    viewport,
    colorScheme: "light",
    instances: [
      {
        componentId,
        id: "glyph",
        key: "a".repeat(64),
        order: 0,
        owner: { kind: "entry" },
        props: { name: ["string", name] },
        propsKey: name,
      },
    ],
    ranges: [],
    resources: [],
    slots: [],
    styles: [],
  }));
}

function component(
  path: string,
  title: string,
  fields: Record<string, unknown> = {},
): ManifestEntry {
  return {
    colorSchemes: ["light"],
    controls: {},
    description: title,
    kind: "component",
    path,
    propSchema: { kind: "object", properties: {} },
    relatedDocs: [],
    slots: [],
    sourcePath: `specs/${path}.mockup.tsx`,
    tags: [],
    title,
    ...fields,
  } as unknown as ManifestEntry;
}

/** The library at one root, where Iconic's glyph Icon is named `glyph`. */
function library(root: string, glyph: string, current: boolean) {
  const variant = (
    parent: string,
    slug: string,
    title: string,
    fields: Record<string, unknown> = {},
  ) =>
    component(`${root}/${parent}/${slug}`, title, {
      componentViews: [],
      props: {},
      suppliedSlots: [],
      variantOf: `${root}/${parent}`,
      ...fields,
    });
  return [
    component(`${root}/action`, "Action", { slots: ["children"] }),
    variant("action", "primary", "Primary"),
    ...(current ? [] : [variant("action", "secondary", "Secondary")]),
    variant("action", "ghost", "Ghost", {
      description: current ? "A quiet action for skipping" : "Ghost",
    }),
    variant("action", "iconic", "Iconic", {
      componentViews: iconViews(`${root}/icon`, glyph),
      suppliedSlots: ["children"],
    }),
    component(`${root}/icon`, "Icon"),
    variant("icon", "arrow", "Arrow"),
  ];
}

const MOVED = [
  "action",
  "action/primary",
  "action/ghost",
  "action/iconic",
  "icon",
  "icon/arrow",
];

const address = (path: string, title: string) => ({ path, title });

/** One review record for a moved entry, or for the deleted Secondary. */
function change(
  path: string,
  title: string,
  reasons: readonly EntryChangeReason[],
): ChangedEntry {
  return path === "secondary"
    ? {
        kind: "component",
        before: address("components/action/secondary", title),
        reasons,
      }
    : {
        kind: "component",
        before: address(`components/${path}`, title),
        after: address(`ui/${path}`, title),
        previousPath: `components/${path}`,
        reasons,
      };
}

function variantReview(
  slug: string,
  title: string,
  state: ComponentVariantReview["state"],
): ComponentVariantReview {
  return slug === "secondary"
    ? { path: "components/action/secondary", title, state, views: [] }
    : {
        path: `ui/action/${slug}`,
        previousPath: `components/action/${slug}`,
        title,
        state,
        views: [],
      };
}

const changes: readonly ChangedEntry[] = [
  change("action", "Action", []),
  change("action/primary", "Primary", []),
  change("secondary", "Secondary", [{ kind: "removed" }]),
  change("action/ghost", "Ghost", [{ kind: "metadata" }]),
  change("action/iconic", "Iconic", [{ kind: "inputs" }]),
  change("icon", "Icon", []),
  change("icon/arrow", "Arrow", []),
];

const result = {
  affectedConsumers: [],
  changes,
  components: [
    {
      ...address("ui/action", "Action"),
      previousPath: "components/action",
      before: address("components/action", "Action"),
      after: address("ui/action", "Action"),
      variants: [
        variantReview("primary", "Primary", "unchanged"),
        variantReview("ghost", "Ghost", "unchanged"),
        variantReview("iconic", "Iconic", "changed"),
        variantReview("secondary", "Secondary", "removed"),
      ],
    },
  ],
  screens: [],
} as unknown as ReviewResultV7;

/**
 * The shell catalogue and server context for the moved library, as Serve and
 * export build them: Changes lists every pairing and removal, while the
 * evidence's own list holds only the entries whose reasons are not empty.
 */
export function movedComponentEvidence(): {
  catalogue: Catalogue;
  context: ShellContext;
} {
  const secondary = library("components", "arrow", false).find(
    (entry) => entry.path === "components/action/secondary",
  )!;
  const catalogue = createCatalogue(
    currentManifest({
      entries: library("ui", "chevron", true),
      folders: [],
      generatedBy: "mokly",
      schemaVersion: 10,
      sourceFiles: [],
    }),
    [{ entry: secondary, folderTitles: ["Components"], parentTitle: "Action" }],
    MOVED.map((path) => ({
      path: `ui/${path}`,
      previousPath: `components/${path}`,
    })),
  );
  const material = changes
    .filter((entry) => entry.reasons.length > 0)
    .map((entry) => (entry.after ?? entry.before)!.path)
    .sort();
  return {
    catalogue,
    context: {
      base: "main",
      changedEntries: [
        ...MOVED.map((path) => `ui/${path}`),
        "components/action/secondary",
      ],
      componentChanges: {
        baseline: {
          entries: library("components", "arrow", false),
        },
        changedEntries: material,
        result,
      },
      updateVersion: 0,
    } as unknown as ShellContext,
  };
}

/** The current or removed entry the shell routes at one path. */
export function routed(catalogue: Catalogue, path: string) {
  const entry = catalogue.byPath.get(path);
  if (entry?.kind !== "component") throw new Error(`Missing ${path}`);
  return entry;
}
