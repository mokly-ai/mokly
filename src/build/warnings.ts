/** Structured, non-fatal diagnostics retained for the CLI warning reporter. */
export interface BuildWarning {
  code: "ignored-declared-resource-owner";
  context: readonly string[];
  message: string;
}
