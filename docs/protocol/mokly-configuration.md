# Mokly Configuration Contract

This is the detailed configuration boundary of the
[package contract](./mokly-package.md). These settings describe current behavior.

## Delivery Status

Approved contract. Current builds configure `entries` globs or the
`entriesDir` shorthand; the [path identity plan](../../plans/path-identity.md)
delivers `roots`. Every other setting in this document is implemented.

## Configuration Discovery

Mokly searches upward from the current working directory for
`mokly.config.ts`, `mokly.config.mts`, `mokly.config.js`, or
`mokly.config.mjs`, unless `--config` is supplied. Discovery stops at the
filesystem root and reports every filename it attempted when none is found.

The config's filesystem paths resolve relative to the config file, never
relative to the installed package or transient npx cache. Repository-matching
globs operate on repo-relative POSIX paths; `publicExclude` uses the
`mockupsDir`-relative matching base specified below. `defineConfig` validates and types
the following contract:

- `mockupsDir`: output/catalogue root, such as `docs/mockups/generated`;
- `roots`: the directories Mokly scans for entry modules and Markdown
  documents, each with optional file globs, a path prefix, and transparent
  directory names, defaulting to one `specs` root;
- `repoRoot`: repository root, defaulting to the config file's directory;
- a light-only or light-and-dark catalogue rendering set;
- optional renderer-module path and declarative route-to-stylesheet rules;
- optional consumer package roots, aliases, conditions, fields, extensions, and
  loaders for app-owned module resolution;
- default Git base ref used to find the `HEAD` branch point, and internal comparison
  directory;
- shared-impact globs for comparisons;
- additional authored inputs and static assets for watched Serve;
- an optional temporary document transformer for an existing consumer cutover.

The resolved config has one repository root, one mockups root, one sorted
resolved source-file set across every root, and normalized repo-relative POSIX
paths. Config
validation rejects path traversal, output outside the repository (including
through symlinks), entry modules inside internal or package-owned private roots,
duplicate rules, and a watch path that cannot be classified safely. An entry
module may be nested below `mockupsDir` as protected authored source; generated
routes are checked separately and cannot collide with it.

Before reading Git, `repoRoot` must resolve through symlinks to the same path
as `git rev-parse --show-toplevel` run from that directory. A nested root fails
with `config-invalid`, naming both paths. This validation belongs to config's
Git boundary, not unconditional config loading: build in either output mode,
committed Check and publication without comparisons need no Git repository.
Derived Check requires Git to inspect tracking. Serve's parent, classifier and
HTTP child, comparison export and preview all validate before their first Git
read. All remains usable when history is unavailable; an explicit comparison
request retains the typed configuration error. Missing refs or history keep
their existing command-specific errors.

No default may encode `docs/mockups` as a mandatory location, product route
families, consumer design tokens, email-template paths, or a TypeScript
workspace layout. A conventional `docs/mockups` layout may be offered by an
explicit initializer or documented example, not hidden in runtime logic.

The normative configuration shape is:

```ts
type ColorScheme = "dark" | "light";

type ModuleLoader =
  | "base64"
  | "binary"
  | "css"
  | "dataurl"
  | "empty"
  | "file"
  | "js"
  | "json"
  | "jsx"
  | "text"
  | "ts"
  | "tsx";

interface RootConfig {
  dir: string; // config-relative directory inside repoRoot
  files?: readonly string[]; // ["**/*.mockup.{ts,tsx}", "**/*.md"]
  path?: string; // prefix for every derived path; none by default
  transparent?: readonly string[]; // directory names removed from paths
}

interface MoklyConfig {
  colorSchemes?: readonly ColorScheme[]; // ["light"]
  generatedOutput?: "committed" | "derived"; // "derived"
  mockupsDir: string;
  roots?: readonly RootConfig[]; // [{ dir: "specs" }]
  publicExclude?: readonly string[]; // extends shipped public exclusions
  repoRoot?: string; // config directory
  renderer?: string;
  moduleResolution?: {
    aliases?: Readonly<Record<string, string>>;
    conditions?: readonly string[];
    loaders?: Readonly<Record<string, ModuleLoader>>;
    mainFields?: readonly string[];
    packageRoots?: readonly string[];
    resolveExtensions?: readonly string[];
  };
  stylesheets?: readonly {
    match: string;
    stylesheets: readonly string[];
    lightStylesheets?: readonly string[];
    darkStylesheets?: readonly string[];
  }[];
  review?: {
    base?: string; // origin/main; merge base with HEAD
    baselineBuild?: readonly (readonly string[])[]; // derived mode only
    outDir?: string; // .context/mokly-review
    sharedImpact?: readonly string[];
  };
  watch?: {
    debounceMs?: number; // 75
    rules?: readonly {
      action: "ignore" | "rebuild" | "reload" | "restart";
      paths: readonly string[];
    }[];
  };
  compatibility?: {
    transformer?: string;
  };
}
```

Filesystem fields (`repoRoot`, `roots[].dir`, `mockupsDir`, `renderer`,
compatibility transformer, module-resolution package
roots, and Review `outDir`) are config-relative. `roots[].files` globs are
relative to their root; `review.sharedImpact` and `watch.rules[].paths` are
repository-relative; see [roots](#roots). Stylesheet file paths are
relative to `mockupsDir`; HTTP(S) stylesheet URLs are allowed.
`colorSchemes` is a non-empty, duplicate-free subset of `"light" | "dark"`
that must include `"light"`; it defaults to `["light"]` and normalizes to
light-first order. Shared `stylesheets` apply to every generated view, with a
matching `lightStylesheets` or `darkStylesheets` list appended in declaration
order.
`generatedOutput` defaults to `"derived"`; the derived-only
`review.baselineBuild` argv list and explicit `"committed"` alternative follow the
[derived baselines contract](./mokly-derived-baselines.md).
`baselineBuild` is invalid in committed mode, including a staged migration;
omit `generatedOutput` or set it to `"derived"` when supplying a
repository-specific recipe.
Derived Check accepts absent local generated output, rejects Git-tracked routes,
the manifest and cache files, and prints their paths plus ignore guidance.
Build writes transactionally in both modes. Serve and export await preparation
before classification; Serve publishes `preparing` when a rebuild is needed,
then `pending` while classification runs. Cache hits skip `preparing`.
`watch.rules[].paths` and Review `sharedImpact` are repository-relative POSIX
globs, while stylesheet `match` matches catalogue routes. `repoRoot` defaults to the config directory. Duplicate stylesheet
matches and watch paths are invalid. Additional watch rules cannot override
configured source/module rebuilds, reloads for configured stylesheets and
referenced resources, or package-owned ignores for dependency, build, test, Review, header-proven
generated, and transaction paths. An unowned public HTML file below
`mockupsDir` remains consumer-authored and can match an explicit watch rule.
The repository's `.mokly-cache/` and its physical aliases are always private
and ignored before source exceptions or broad globs, and cannot be configured
as a root, mockups, Review output, or an export destination.
The recommended layout is a dedicated spec tree: the default root `specs`
holds screens, pages, documents, and flows by product area, with
`mockupsDir: "specs/generated"` or another output directory and
`renderer: "specs/renderer.tsx"`, so publication output never mixes with
authored files. A component library adds a second root over its source tree,
such as `{ dir: "packages/ui/src", path: "components" }`, so component mockups
stay beside component code. The documented alternative co-locates every mockup
beside the product code it describes, for example
`{ dir: "src/features", transparent: ["__mockups__"] }`; both layouts produce
the same catalogue paths under the [path contract](./mokly-paths.md). The
`.mockup.ts` and `.mockup.tsx` names are the convention the default `files`
pattern selects, not a runtime suffix rule.
Authored source directories and entry modules may sit below `mockupsDir`. They
remain inventoried protected inputs rather than public output. A root
directory must not equal `mockupsDir`; matched files may sit below it. Generated routes are collision-checked against every inventoried
source before writing, including through aliases. Review output must not overlap an entry
module's directory or `mockupsDir` in either direction. Those boundaries are
covered by the nested discovery, output collision, and public alias tests in
[`entry_discovery.test.ts`](../../tests/entry_discovery.test.ts),
[`output_safety.test.ts`](../../tests/output_safety.test.ts), and
[`server_safety.test.ts`](../../tests/server_safety.test.ts). The rule applies
to configured comparison output and the transactional writer boundary. The
[npm CLI](./mokly-package.md#cli) has no Review command or output override; the repository-only
[preview builder](./mokly-publication.md#publication-option) separately accepts
`--out` for its published catalogue. Export's
required `--out` has the additional source/runtime/ownership confinement rules
in the [export contract](./mokly-export.md).

`review.sharedImpact` is fallback impact evidence for files the rendered resource
graph cannot see, such as renderer, component-source, or token modules. Linked
stylesheets, including transitive imports, are attributed by rule under
[CSS change attribution](./mokly-css-attribution.md). A changed stylesheet keeps
a view's dependency evidence only when a changed rule could match its before or
after document, or analysis is unresolved. Otherwise it is examined and excluded.
Shared-impact globs cannot override this exclusion or add unreferenced public
files to Changes, and a glob match alone never adds an entry; see
[component attribution](./mokly-component-changes.md#dependencies-and-styles).

`moduleResolution` has no defaults beyond esbuild's platform behavior. Package
roots must be in-repository directories containing `package.json`; their
`node_modules` directories supplement consumer lookup. Aliases accept bare
package specifiers only. Conditions, package fields, and extensions are ordered,
deduplicated lists, while loader keys are extensions and values are supported
esbuild loader names. React and React DOM still resolve through Mokly's
consumer-peer plugin so these options cannot introduce a second React runtime.

The obsolete `legacy`, `entries`, and `entriesDir` config keys are rejected,
including when their value is `undefined`. Register every complete HTML
document explicitly with `definePage`; Markdown documents are discovered
through roots; baseline compatibility never restores old configuration.

## Roots

`roots` is a non-empty list of root objects. `dir` names an existing
directory inside `repoRoot`, config-relative, outside `.mokly-cache/`, Review
output, and package-owned private roots, and not equal to `mockupsDir`.
`files` is a non-empty list of safe relative POSIX globs matched against paths
relative to `dir` with the same minimatch syntax and path rules as
`review.sharedImpact`; it defaults to `**/*.mockup.{ts,tsx}` and `**/*.md`.
`path` is a path under the [segment grammar](./mokly-paths.md#segment-grammar)
and prefixes every path derived from the root. `transparent` lists directory
names, each a valid segment, that derivation removes. Omitting `roots` means
`[{ dir: "specs" }]`. A missing directory, an empty or duplicate glob, two
roots with the same `dir`, or an invalid `path` or `transparent` value fails
with `config-invalid` naming `roots[<index>].<field>`.

Discovery walks each root without following symlinks and keeps every regular
file that matches a `files` glob. Below the root, walks skip directories named
`.git`, `node_modules`, `.mokly-cache`, `dist`, `coverage`, `target`,
`test-results`, `playwright-report`, or `.context`, or prefixed with
`.mokly-review-` or `.mokly-write-`; an explicit root inside such a directory
is still scanned, because the rule applies below the root only. Regular file
basenames are not denied. `_folder.json` files are read as
[folder records](./mokly-folders.md) and never as entries, and a folder
record's `exclude` globs remove matched files from that directory before
derivation. A matched file ending in `.md` is a
[document](./mokly-documents.md); every other matched file is an entry module
under the [entry module contract](./mokly-entry-modules.md). The glob alone
defines the shape, so `files: ["**/*.ts"]` evaluates every matched TypeScript
file as a module.

Before any walk, discovery projects the repository identity and every distinct
root identity once for the pass, and `review.outDir` once with a lexical
fallback only for that Review boundary. A non-benign repository or root
projection error fails before per-root validation. Walks run in declared root
order and validate matched files during each walk. The first denial or
empty-root failure stops the pass. Accepted and vanished candidates are each
validated once per pass. Walks skip either Review identity and directories
that vanish or are replaced (`ENOENT` or `ENOTDIR`). Other read or projection
errors fail with `config-invalid`, naming the repository-relative path and
error code (`unknown` if absent). A matched file that is deleted or replaced by
something other than a regular file between listing and validation is dropped
and listed under `not searched` when its root is then empty.

Every root must retain a file; otherwise `root matches no file: <dir>` lists
denied and vanished paths, including dropped files, sorted under
`; not searched: <repository-relative paths>`. The union across roots is
sorted and deduplicated by repository-relative path. A file matched by two
roots derives two paths and fails as a duplicate path unless the roots are
identical, which configuration already rejects.

Every resolved file is classified before bundling. Discovery fails with
`config-invalid` naming the file and the matched rule when it lies inside
`review.outDir`, inside `.mokly-cache/`, below a denied directory relative to
its root, or resolves outside `repoRoot` through a symlink. A file below
`mockupsDir` is protected authored source under the
[source-protection contract](./mokly-source-protection.md), cannot be served
or exported as a public file, and remains protected through aliases.
Generated output is collision-checked against it.

Discovery runs when the configuration is resolved, so every resolved config
carries its sorted file set beside `roots`, and again at the start of each
compilation so watched Serve observes created, renamed, or deleted files as
defined by the [watch contract](./mokly-watch.md). The set is retained beside
`sourceFiles` across build, check, watched Serve, publication, and the
component runtime; later stages consume it and never repeat the walk within
one compilation. Generated output is trusted for replacement when its recorded
repository-relative owner is a resolved file, an inventoried source, or lies
below a configured root and matches one of its `files` globs with dotfile
matching enabled. The match rule keeps output owned after a matched file is
renamed, moved, or deleted, which the [move contract](./mokly-moves.md)
depends on. An ownership header that satisfies none of the three branches is
unclaimed: committed `check` reports it, while Build, Serve, and Export leave
the file untouched. Registry attribution remains narrower and accepts only a
resolved entry module or inventoried source.

A matched barrel that re-exports another matched module's definitions derives
the same paths twice and fails as a duplicate path. Narrow the globs, rename
the barrel so no glob matches it, or stop re-exporting definitions.

## Public Exclusion Configuration

`publicExclude?: readonly string[]` extends the defaults in the
[source-protection contract](./mokly-source-protection.md#public-exclusions):
`**/README`, `**/README.*`, `**/tsconfig.json`, and `**/tsconfig.*.json`.
The case-folded defaults are prepended without mutating consumer input;
omission and an empty array produce the defaults alone.
The resolved list is frozen. Watched children require this already-resolved
array and use the shared glob validator to adopt a frozen copy with exactly
the transferred entries, without prepending defaults again. Missing, non-array
or unsafe values reject the startup message. Repeated globs are harmless and
do not fail config.

Validate the array and each string at config load. A safe relative POSIX glob
is nonempty and contains no absolute/drive/UNC prefix, backslash,
colon, NUL/control character, or empty, `.` or `..` path segment. Reject
whitespace-only strings, leading `!` negation, and leading `#` comment syntax.
Use the repository's minimatch glob syntax; any brace-expanded alternative must
also satisfy those path rules. Invalid input fails with the typed `config-invalid`
error naming `publicExclude` and the offending item, before publication or serving.

Match the whole candidate path relative to `mockupsDir`, not relative to
`repoRoot` or the config directory, with case-insensitive and dotfile matching.
For example, `publicExclude: ["internal/**"]` hides that directory's contents
under `mockupsDir` in addition to every shipped default. Realpath aliases and
all public-resource boundaries use the same source-protection policy.
