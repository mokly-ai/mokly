import type { ManifestV10 } from "@mokly/viewer/data";

import type { Compilation } from "../../dist/build/compile.js";
import {
  MANIFEST_NAME,
  serializeManifest,
} from "../../dist/registry/manifest.js";

/** Small compilation with text, binary output, a warning and optional Markdown. */
export function snapshotCompilation(documentMarkdown = true): Compilation {
  const manifest = {
    entries: [],
    folders: [],
    generatedBy: "mokly",
    schemaVersion: 10,
    sourceFiles: [],
  } as unknown as ManifestV10;
  return {
    diagnostics: [
      {
        code: "link-control-ancestor",
        message: "A link control sits inside another interactive element.",
        route: "home/index.html",
      },
    ],
    manifest,
    outputs: new Map<string, string | Uint8Array>([
      [MANIFEST_NAME, serializeManifest(manifest)],
      ["styles.css", "body { color: red; }\n"],
      ["mokly-generated/logo.png", Uint8Array.from([0, 1, 2, 128, 255])],
    ]),
    deliveredStyleSources: ["examples/basic/styles.css"],
    ...(documentMarkdown
      ? { documentMarkdown: new Map([["docs/guide.md", "# Guide\n"]]) }
      : {}),
  };
}
