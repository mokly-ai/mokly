/** Supervisor-confirmed M8 fast/complete differences; these are not M9 fixes. */
export const fingerprintReplayExclusions = [
  {
    file: "changes_asset_aliases.test.ts",
    test: "screen Changes follows a stable file alias to its edited target",
    reason:
      "5e5111dc committed fast path succeeds; complete comparison rejects the baseline Git symlink (image.svg).",
  },
  {
    file: "changes_asset_aliases.test.ts",
    test: "screen Changes follows a stable directory alias to its edited target",
    reason:
      "5e5111dc committed fast path succeeds; complete comparison reports the baseline aliased path missing (images/logo.svg).",
  },
];
