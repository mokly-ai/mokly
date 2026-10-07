/** Small manifest literals for catalogue-selection contract tests. */
import type {
  ManifestComponent,
  ManifestComponentVariant,
} from "../../packages/viewer/dist/components/manifest_types.js";
import type {
  ManifestPage,
  ManifestScreen,
  ManifestV9,
} from "../../packages/viewer/dist/registry/types.js";

const metadata = {
  declaredDependencies: [],
  description: "Selection fixture",
  relatedDocs: [],
  sourcePath: "specs/selection.mockup.tsx",
  title: "Selection fixture",
};
/** Owning screen beneath the selected folder. */
export const screen: ManifestScreen = {
  ...metadata,
  kind: "screen",
  path: "design/components/overview",
  colorSchemes: ["light"],
  useCasePaths: [],
};
/** Screen variant placed before its parent in manifest order. */
export const screenVariant: ManifestScreen = {
  ...screen,
  path: "design/components/overview/active",
  variantOf: screen.path,
};
/** Page that tests kind filtering beside screens. */
export const page: ManifestPage = {
  ...metadata,
  kind: "page",
  path: "design/components/page",
};
const folderEntry: ManifestPage = { ...page, path: "design/components" };
/** Entry beneath a similarly named sibling folder. */
export const sibling: ManifestScreen = {
  ...screen,
  path: "design/componentsx/a",
};
/** Component parent accepted by componentParent. */
export const parent: ManifestComponent = {
  ...metadata,
  kind: "component",
  path: "design/library/action",
  colorSchemes: ["light"],
  propSchema: { kind: "object", properties: {} },
  slots: [],
  controls: {},
  ownedDependencies: [],
};
/** Component variant that componentParent must reject. */
export const componentVariant: ManifestComponentVariant = {
  ...metadata,
  kind: "component",
  path: "design/library/action/active",
  colorSchemes: ["light"],
  variantOf: parent.path,
  props: {},
  suppliedSlots: [],
  componentViews: [],
};
/** Small current manifest with mixed kinds, variants, and folder boundaries. */
export const manifest: ManifestV9 = {
  entries: [
    screenVariant,
    folderEntry,
    screen,
    page,
    sibling,
    componentVariant,
    parent,
  ],
  assetClosure: [],
  blobHashAlgorithm: "sha256",
  generatedFiles: [],
  generatedBy: "mokly",
  schemaVersion: 9,
  folders: [],
  sourceFiles: [],
};
