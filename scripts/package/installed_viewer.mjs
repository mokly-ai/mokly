import path from "node:path";
import { pathToFileURL } from "node:url";

/** Load `@mokly/viewer/data` from a consumer's installed archive, never from this repository's workspace link. */
export async function installedViewerData(consumerRoot) {
  return await import(
    pathToFileURL(
      path.join(consumerRoot, "node_modules/@mokly/viewer/dist/data.js"),
    ).href
  );
}
