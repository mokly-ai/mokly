// Shared example checks do not use Changes. Real Changes specs own Git fixtures.
export const EXAMPLE_BASE = "refs/mokly/browser-suite-no-base";

/** The invalid shared base emits one diagnostic and starts no base render work. */
export function validateExampleDiagnostics(output: string): void {
  if ((output.match(/\[mokly\/git-failed\]/g) ?? []).length !== 1)
    throw new Error(`Expected one shared example Git diagnostic:\n${output}`);
}
