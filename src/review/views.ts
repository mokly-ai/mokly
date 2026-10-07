import {
  generatedResourcePath,
  generatedViews,
  type ManifestEntry,
} from "@mokly/viewer/data";

/** Comparison documents share the catalogue-relative namespace with authored resources. */
export function reviewViews(entry: ManifestEntry) {
  return generatedViews(entry).map((view) => ({
    ...view,
    path: generatedResourcePath(view.path),
  }));
}
