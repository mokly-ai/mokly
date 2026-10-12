interface FingerprintCatalogueRecord {
  file?: string;
  catalogues: number;
  pairs: number;
  fingerprintHashes: number;
  fingerprintedViews: number;
  failures: number;
  excludedCatalogues: number;
  excludedPairs: number;
}

/** Read catalogue proof records from nested test-runner output. */
export function parseFingerprintCatalogueRecords(
  output: string,
): FingerprintCatalogueRecord[] {
  const prefix = "Fingerprint catalogue proof ";
  return output
    .split("\n")
    .map((line) => (line.startsWith("# ") ? line.slice(2) : line))
    .filter((line) => line.startsWith(prefix))
    .map(
      (line) =>
        JSON.parse(line.slice(prefix.length)) as FingerprintCatalogueRecord,
    );
}
