import { escapeTerminalControlCharacters } from "../diagnostics/terminal_text.js";
import { MoklyError } from "../errors.js";

/** Stable copy shared by plain failures and rich CLI presentation. */
export const CHECKOUT_ERROR_COPY = {
  "git-uncommitted": {
    headline: "The checkout has uncommitted changes.",
    hint: "Commit, stash or ignore these files, then publish again.",
  },
  "build-stale": {
    headline: "The committed generated files are out of date.",
    hint: "Run mokly build, commit the result and publish again.",
  },
} as const;

/** One safe, bounded checkout failure with recovery copy in plain output. */
export function checkoutFailure(
  code: keyof typeof CHECKOUT_ERROR_COPY,
  paths: readonly string[],
  duringExport = false,
  ignoreRules: readonly string[] = [],
): MoklyError {
  const copy = CHECKOUT_ERROR_COPY[code];
  const sorted = [...new Set(paths)].sort();
  return new MoklyError(
    code,
    [
      copy.headline,
      ...(duringExport ? ["Changes appeared during the export."] : []),
      ...sorted
        .slice(0, 20)
        .map((name) => `  - ${escapeTerminalControlCharacters(name)}`),
      ...(sorted.length > 20
        ? [
            `  … ${sorted.length - 20} other ${sorted.length === 21 ? "path" : "paths"}.`,
          ]
        : []),
      ...(ignoreRules.length
        ? [
            "Add these rules to the repository's .gitignore:",
            ...ignoreRules.map(
              (rule) => `  ${escapeTerminalControlCharacters(rule)}`,
            ),
          ]
        : []),
      copy.hint,
    ].join("\n"),
  );
}
