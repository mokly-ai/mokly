# Directory Constants And Import Lint

## Delivery Status

The independent generated-directory literal rule is implemented, including
escaped string, template and regular-expression spellings. The approved follow-on
work adds the viewer namespace, merged folder-coverage probes and duplicate-import
enforcement. [Generated Output Simplification](../../plans/generated-output-simplification.md)
tracks implementation and verification.

## Directory Name Rule

Use a repository-local ESLint plugin rule named
`mokly/no-directory-literals`, independent of `no-restricted-syntax`.
Its only production definition exemption is
`packages/viewer/src/catalogue/delivery_paths.ts`, the owner of both constants.
Register the plugin once in flat config and apply the rule at error severity to:

```text
src/**/*.{ts,tsx}
packages/viewer/src/**/*.{ts,tsx}
scripts/preview/**/*.mjs
```

Reject any occurrence of `mokly-generated`, and, after the namespace rename,
`mokly-viewer`, in a string literal, template literal segment, or
regular-expression literal. Include names embedded in paths and diagnostics.
Check cooked string/template values and raw spellings; regex checks must read
the pattern rather than depend on a regex object's string value. A literal
such as `/^mokly-generated\//` must fail. Recognize literal character escapes
in regex patterns (`\xNN`, `\uNNNN`, `\u{...}` and escaped punctuation) so an
escaped spelling of the same name cannot bypass the check. This is a literal
guard, not a general evaluator of concatenations or arbitrary regex languages.

Use these exact messages, with one report per offending literal/segment and
name:

```text
Import GENERATED_DIRECTORY instead of spelling the output directory.
Import VIEWER_DIRECTORY instead of spelling the viewer directory.
```

Do not flag comments, type/variable/property identifiers, or correctly imported
constant expressions. Tests, docs and test fixtures outside these production
globs may spell the names. Do not add a broad production exclusion or disable
the rule in path helpers. The local lint implementation can name its own match
strings outside these production globs. Do not implement this with another
`no-restricted-syntax` block.

## Locale-Independent Source Ordering

Keep `main`'s separate `no-restricted-syntax` rule, selector
`CallExpression[callee.property.name='localeCompare']`, at error severity for:

```text
src/config/**/*.ts
src/build/discovery.ts
src/build/styles/**/*.ts
src/build/source_inventory.ts
src/build/package_owned_paths.ts
```

Keep its message:

```text
Sort source paths with compareCodeUnits to avoid locale-dependent inventories and diagnostics.
```

Use `main`'s `compareCodeUnits` helper at those boundaries. Do not expand the
ban to presentation sorting; `main`'s navigation label comparator deliberately
uses English collation. Both rule IDs must be active on overlapping files.
The new local rule must not replace or weaken this existing rule's options.

## Duplicate Imports

Enable `import/no-duplicates: "error"` on the installed `eslint-plugin-import-x`
plugin already registered as `import`, at the same global scope as
`import/first` and `import/order`. Use its default options. Apply the rule's
automatic fix to the merged code, including newly arrived files, then rerun
import ordering, type checking and tests. Do not suppress duplicates or replace
imports with forwarding modules. Preserve type-only import behavior, side
effects and the existing package ownership boundary.

## Coverage Contract

Test the repository's actual resolved flat config through ESLint's Node API,
not a separately recreated rule list. Each probe uses `lintText` and a synthetic
filename under the folder being checked; no source probe is written to disk.

- Enumerate every existing production folder that contains a file matched by
  the directory rule, under all three roots. Probe that folder with the same
  supported extension; also test a `.tsx` path under each TypeScript root and
  a nested `.mjs` path under `scripts/preview`. Do not skip a matched folder
  because its real files currently contain no directory literal.
- For every folder matched by the recursive locale rule, probe a `.ts` file.
  Also probe each of its three individually named build files, and synthetic
  nested paths under `src/config` and `src/build/styles`. This covers both
  recursive globs and exact-file config entries.
- At every directory-rule probe, assert the exact local rule ID and message
  for string, embedded path, template and regex forms of each enabled name.
  Include character-escaped forms. Assert that importing the constants passes.
  Verify the single defining-module exemption separately.
- At every locale-rule probe, assert that a `localeCompare` call fails that
  rule and a `compareCodeUnits` call passes. Put both failures in the same
  source on overlap paths and require both rule IDs in the result.
- Probe duplicate imports in each production root and a test file. Require
  `import/no-duplicates`; apply its fixer and verify one equivalent merged
  import with no duplicate-import report. Retain type-import checks.

Reject an ignored-file result or a missing expected rule as a test failure;
an empty message list is not proof that the file was linted. Use the actual
ignore configuration, including `main`'s Git-ignore integration and this
branch's generated output/cache ignores. Verify an unrelated presentation
folder remains outside the locale ban. These tests must fail if a later flat
config block replaces either rule or an intended folder drops out of coverage.
