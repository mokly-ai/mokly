/**
 * The `./data` entry, with no React dependency: the pure path functions and
 * directory names of the artifact path contract, the path, link, and
 * fragment grammar, and the prop schema validators of the entry props
 * contract, which generate no code.
 */

export {
  GENERATED_DIRECTORY,
  VIEWER_DIRECTORY,
  currentDocumentPath,
  currentDocumentRoute,
  isEntryPath,
  isLinkPath,
  isLogicalFragment,
  isPathSegment,
  isWindowsDeviceName,
} from "@mokly/model";
export {
  generatedResourcePath,
  generatedResourceRoute,
} from "./catalogue/delivery_paths.js";
export {
  documentRoute,
  entryRoute,
  parseViewHref,
  previewMetadataPath,
  providerNormalizedHtmlPath,
  snapshotDocumentPath,
  snapshotResourcePath,
  snapshotSidePath,
  snapshotViewPath,
  viewHref,
  viewRoute,
} from "./navigation/routes.js";
export type {
  EntryRouteKind,
  SnapshotSide,
  ViewRouteKind,
} from "./navigation/routes.js";

export { validatePropSchema } from "./components/profile_schema.js";
export { validateProps } from "./components/props.js";
