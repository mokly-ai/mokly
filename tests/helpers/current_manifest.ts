/** Supply the v6 output inventory for structural manifest validation fixtures. */
export function currentManifest(manifest: object) {
  return {
    ...manifest,
    assetClosure: [],
    blobHashAlgorithm: "sha1",
    generatedFiles: [],
    schemaVersion: 6,
  };
}
