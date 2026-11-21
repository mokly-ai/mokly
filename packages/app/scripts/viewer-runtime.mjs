/** Require the package shell and the version headline of the pinned release. */
export function assertViewerRuntime(bundle) {
  const required = [
    "data-mokly-shell",
    "This catalogue needs a compatible viewer",
  ];
  if (required.some((marker) => !bundle.includes(marker))) {
    throw new Error(
      "the web bundle does not contain the published viewer runtime",
    );
  }
}
