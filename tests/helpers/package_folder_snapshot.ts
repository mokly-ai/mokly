import assert from "node:assert/strict";
import path from "node:path";

import type { ImportKind, Metafile } from "esbuild";

import type { BundleParams } from "../../packages/mokly/src/generated/sidecar/BundleParams.js";
import type { ReuseEvidence } from "../../packages/mokly/src/generated/sidecar/ReuseEvidence.js";
import { ModulePaths } from "../../packages/mokly/src/sidecar/module-paths.js";
import { resolutionInputs } from "../../packages/mokly/src/sidecar/resolution-inputs.js";
import { serveEditLookups } from "../../packages/mokly/src/sidecar/serve-edit-lookups.js";

interface FolderSnapshot {
  evidence: ReuseEvidence;
  listings: Record<string, string[]>;
  certify(): Promise<boolean>;
}

/** Record the same import and final listings that the marked bundle recipe uses. */
export async function folderSnapshot(
  params: BundleParams,
  selected: string,
  request = "chosen/sub/value",
  kind: ImportKind = "import-statement",
): Promise<FolderSnapshot> {
  const paths = await ModulePaths.create(params);
  const metafile: Metafile = {
    inputs: {
      [path.join(params.sourceRoot, "entry.mjs")]: {
        bytes: 0,
        imports: [{ path: selected, original: request, kind }],
      },
    },
    outputs: {},
  };
  const checks = serveEditLookups(
    metafile,
    paths,
    path.resolve(params.sourceRoot, params.configurationDirectory),
  );
  assert.notEqual(checks, undefined);
  assert.notEqual(checks!.folders, undefined);
  const { inputDirectories } = await resolutionInputs(
    paths,
    [selected],
    {},
    {},
  );
  return {
    evidence: checks!.evidence,
    listings: inputDirectories,
    certify: () => checks!.folders!.certify(inputDirectories, checks!.evidence),
  };
}
