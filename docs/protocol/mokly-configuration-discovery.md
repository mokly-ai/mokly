# Configuration Discovery And Exclusions

Continuation of [Configuration](./mokly-configuration.md).

## Entry Discovery

`entries` is a non-empty ordered list of safe relative POSIX globs matched
against repository-relative paths under `repoRoot`, using the same minimatch
syntax and path rules as `review.sharedImpact`. `entriesDir` is validated
exactly as before, must name an existing directory inside `repoRoot`, and is
resolved to the single glob `<dir>/**/*.mockup.{ts,tsx}` relative to
`repoRoot`. Exactly one of the two fields must be present; supplying both,
neither, an empty list, a duplicate glob, or a glob whose stable prefix lies
inside `.mokly-cache/` fails with `config-invalid` naming the field.

Discovery walks each glob's stable prefix, the leading segments before the
first wildcard, without following symlinks, and keeps every regular file that
matches the glob. The glob alone defines the entry shape. Mokly applies no
filename suffix or extension filter, so `entries: ["src/**/*.ts"]` evaluates
every matched TypeScript file as an entry module. Mokly reads `mockups` or a
default registry value from each; a matched helper with neither contributes no
definitions and can produce the normal empty-registry error.
`.mockup.ts` and `.mockup.tsx` remain the recommended naming convention, and
the `entriesDir` shorthand preserves it through its generated glob.

Below the deepest matching glob root, walks skip directories named `.git`,
`node_modules`, `.mokly-cache`, `dist`, `coverage`, `target`, `test-results`,
`playwright-report`, or `.context`, or prefixed with `.mokly-review-` or
`.mokly-write-`. Regular file basenames are not denied. The rule is relative
to the glob root: `src/dist/x.mockup.tsx` is denied under
`src/**/*.mockup.{ts,tsx}`, while an explicit `dist/entries/**` root can
discover `dist/entries/a.mockup.tsx` because the package-owned directory rule
only applies below that explicit root. Discovery never inspects a denied tree.

Before any glob walk, discovery projects the repository identity and every
distinct glob-root identity once for the pass. It also projects `review.outDir`
once, with a lexical fallback only for that Review boundary. A non-benign
repository or glob-root projection error therefore fails before per-glob module
validation; an error projecting a later glob's root can precede a denial under
an earlier glob. Walks then run in declared glob order and validate matched
modules during each walk. The first denial or zero-match failure stops the pass,
so an earlier glob's denied module precedes a later empty glob, while reversing
those globs makes the empty-glob diagnostic precede the denial.

Accepted and vanished candidates are each validated once per pass. An accepted
candidate still counts as a match for every later overlapping glob; a vanished
candidate does not. Walks skip either Review identity and directories that
vanish or are replaced (`ENOENT` or `ENOTDIR`). Other read or projection errors
fail with `config-invalid`, naming the repository-relative path and error code
(`unknown` if absent). A matched module that is deleted, or replaced by
something other than a regular file, between the directory listing and
validation is dropped and listed under `not searched` when its glob is then
empty. A projection or lstat failure with any code other than `ENOENT` fails
with `config-invalid`.

Normal configuration validation rejects a glob whose stable prefix is inside
`.mokly-cache/` before discovery. The discovery boundary retains the same
private-cache denial for direct callers. Module existence is checked before
that denial, so a cache candidate that vanishes concurrently is dropped and,
when it was the only match, listed under `not searched`; a surviving cache
candidate is rejected. The race never makes a private cache path readable.

Every glob must retain a module; otherwise
`entries glob matches no module: <glob>` lists denied and vanished paths,
including dropped modules, sorted under
`; not searched: <repository-relative paths>`. Validation is per glob so one
valid glob cannot hide a typo or silent omission in another. The union is
sorted and deduplicated by repository-relative path, independent of glob or
filesystem order.

Every resolved entry module is classified before bundling. Discovery fails
with `config-invalid` naming the module and the matched rule when the module
lies inside `review.outDir`, inside `.mokly-cache/`, below a denied directory
relative to its deepest matching glob root, or resolves outside `repoRoot`
through a symlink. An entry module may sit below `mockupsDir` in a nested
`docs/mockups/src` layout; it is protected authored source under the
[source-protection contract](./mokly-source-protection.md), cannot be served or
exported as a public file, and remains protected through aliases. Generated
routes are collision-checked against it. The check runs once per resolved
module instead of once per configured directory.

Discovery runs when the configuration is resolved, so every resolved config
carries its sorted entry set beside `entryGlobs`, and again at the start of
each compilation so watched Serve observes created, renamed, or deleted entry
modules as defined by the [watch contract](./mokly-watch.md). The set is
retained beside `sourceFiles` across build, check, watched Serve, publication,
and the component runtime; later stages consume it and never repeat the glob
walk within one compilation. Registry attribution accepts only a resolved entry
module or an inventoried source. Generated output belongs to one disposable
`mokly-generated/` child, so ownership headers and deleted-source glob matches
do not decide replacement. See [generated output](./mokly-generated-output.md).

A matched barrel that re-exports another matched module's registry array fails
with `duplicate-id`. Narrow the glob, rename the barrel so the glob no longer
matches it, or stop re-exporting registry arrays.

## Public Resource Selection

`publicExclude` was removed. Supplying it, including as `undefined`, fails with
`config-invalid` and the documented migration diagnostic. Public files are the
validated referenced [asset closure](./mokly-generated-output.md#closure-urls-and-publication).
README/tsconfig names are not automatically public or excluded by their names;
source protection still denies actual inputs and reserved source names.
