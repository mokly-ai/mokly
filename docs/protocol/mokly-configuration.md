# Mokly Configuration Contract

This is the detailed configuration boundary of the
[package contract](./mokly-package.md). These settings describe current behavior.

## Delivery Status

Glob-based entry discovery through `entries`, the `entriesDir` shorthand, and
the per-match source classification below are the approved target tracked by
the [co-located entry discovery plan](../../plans/co-located-entry-discovery.md).
Every other setting in this document is implemented.

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
- `entries`: repository-relative POSIX globs that discover `*.mockup.ts` and
  `*.mockup.tsx` entry modules anywhere in the repository, or the `entriesDir`
  shorthand for one directory;
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
resolved entry-module set, and normalized repo-relative POSIX paths. Config
validation rejects path traversal, output outside the repository (including
through symlinks), an entry module that overlaps generated or internal roots,
duplicate rules, and a watch path that cannot be classified safely.

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

interface MoklyConfig {
  colorSchemes?: readonly ColorScheme[]; // ["light"]
  entries?: readonly string[]; // exactly one of entries or entriesDir
  entriesDir?: string; // shorthand for [`${dir}/**/*.mockup.{ts,tsx}`]
  generatedOutput?: "committed" | "derived"; // "derived"
  mockupsDir: string;
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
    readManifestV2?: boolean; // false
    transformer?: string;
  };
}
```

Filesystem fields (`repoRoot`, `entriesDir`, `mockupsDir`, `renderer`,
compatibility transformer, module-resolution package
roots, and Review `outDir`) are config-relative. `entries` globs are
repository-relative, like `review.sharedImpact` and `watch.rules[].paths`;
see [entry discovery](#entry-discovery). Stylesheet file paths are
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
as an entry glob root, mockups, Review output, or an export destination.
Two layouts are recommended. A sibling layout for a repository-root config
uses `entriesDir: "docs/mockups/entries"`, `mockupsDir: "docs/mockups/generated"`,
and `renderer: "docs/mockups/renderer.tsx"`; public assets live under
`generated`, and README and tsconfig files can live beside it with the renderer
and entry sources, so publication output never mixes with developer files. A
co-located layout keeps each entry module beside the product component or
screen it describes, for example `entries: ["src/**/*.mockup.{ts,tsx}"]` with
the same `mockupsDir` and renderer. Both layouts are examples, not runtime
defaults.
Authored source directories may sit below `mockupsDir` for a `docs/mockups/src`
layout, but no entry module may be the output root or lie inside it; generated
routes are collision-checked against every inventoried source before writing.
Review output must not overlap an entry module's directory or the output root
in either direction. That rule applies
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
files to Changes; they retain the existing ownership and membership rules in
[Changes](./mokly-changes.md) and [component attribution](./mokly-component-changes.md).

`moduleResolution` has no defaults beyond esbuild's platform behavior. Package
roots must be in-repository directories containing `package.json`; their
`node_modules` directories supplement consumer lookup. Aliases accept bare
package specifiers only. Conditions, package fields, and extensions are ordered,
deduplicated lists, while loader keys are extensions and values are supported
esbuild loader names. React and React DOM still resolve through Mokly's
consumer-peer plugin so these options cannot introduce a second React runtime.

The `legacy` config key is rejected, including `legacy: undefined`. Register
complete documents explicitly with `definePage` or nested `page`, following the
[source-preserving migration](./mokly-page-migration.md). Historical manifest
compatibility does not restore source discovery or legacy configuration.

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
first wildcard, and keeps every regular file that matches the glob and ends in
`.mockup.ts` or `.mockup.tsx`. Other matched names are never entry modules,
even when a glob names them explicitly; they remain ordinary imported helpers.
The union of all globs, deduplicated by repository-relative path and sorted by
that path, is the resolved entry set. Discovery order therefore depends on
neither glob order nor filesystem order. A glob that keeps zero entry modules
fails with `config-invalid` naming that glob, so a typo cannot silently produce
an empty or partial catalogue.

Every resolved entry module is classified before bundling. Discovery fails
with `config-invalid` naming the module and the matched rule when the module
is the output root or inside `mockupsDir`, inside `review.outDir`, inside
`.mokly-cache/`, inside a package-owned ignored directory such as
`node_modules`, `dist`, `target`, or `.context`, or resolves outside `repoRoot`
through a symlink. This is the same per-file source classification used by the
[source-protection contract](./mokly-source-protection.md); the check runs once
per resolved module instead of once per configured directory.

The resolved entry set is retained beside `sourceFiles` across build, check,
watched Serve, publication, and the component runtime. Later stages consume
that set and never repeat the glob walk within one compilation. The watched
server re-runs discovery when a file matching an entry glob is created,
renamed, or deleted, as defined by the [watch contract](./mokly-watch.md).

## Public Exclusion Configuration

`publicExclude?: readonly string[]` extends the defaults in the
[source-protection contract](./mokly-source-protection.md#public-exclusions):
`**/README`, `**/README.*`, `**/tsconfig.json`, and `**/tsconfig.*.json`.
The defaults are case-folded, so consumers need not add case variants.
Resolution prepends them to consumer entries without
mutating the input; omission and an empty array produce the defaults alone.
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
