# Mokly Configuration Contract

This is the detailed configuration boundary of the
[package contract](./mokly-package.md). The generated-output updates are an
approved target tracked by [the active plan](../../plans/generated-output-simplification.md).

## Delivery Status

Every setting in this document is implemented, including glob-based entry
discovery through `entries` and the `entriesDir` shorthand delivered by the
[co-located entry discovery plan](../../plans/co-located-entry-discovery.md).

## Configuration Discovery

Mokly searches upward from the current working directory for
`mokly.config.ts`, `mokly.config.mts`, `mokly.config.js`, or
`mokly.config.mjs`, unless `--config` is supplied. Discovery stops at the
filesystem root and reports every filename it attempted when none is found.

The config's filesystem paths resolve relative to the config file, never
relative to the installed package or transient npx cache. Repository-matching
globs operate on repo-relative POSIX paths. `defineConfig` validates and types
the following contract:

- `mockupsDir`: catalogue root, such as `docs/mockups`, with generated output
  confined to its `.generated/` child;
- `entries`: repository-relative POSIX globs that define which regular files
  are entry modules anywhere in the repository, or the `entriesDir` shorthand
  for conventional `.mockup.ts` and `.mockup.tsx` files in one directory;
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
through symlinks), entry modules inside internal or package-owned private roots,
duplicate rules, and a watch path that cannot be classified safely. An entry
module may be nested below `mockupsDir` as protected authored source, but not
inside `.generated/`, including through aliases. Configured entries, renderer,
transformer, and package roots in that child fail `config-invalid` with the
setting and path; imported authoring sources fail with their path. See
[generated output](./mokly-generated-output.md).

Before reading Git, `repoRoot` must resolve through symlinks to the same path
as `git rev-parse --show-toplevel` run from that directory. A nested root fails
with `config-invalid`, naming both paths. This validation belongs to config's
Git boundary, not unconditional config loading: Build, Check, Serve, and
publication without comparisons work without Git. Only Check inspects the
current index (never `.gitignore`), treating no Git as untracked; Build and
Serve never decide their behavior from head tracking.
Serve's parent, classifier and
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
  mockupsDir: string;
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
    baselineBuild?: readonly (readonly string[])[]; // used when baseline needs rebuilding
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
`review.baselineBuild` is valid in every repository; its argv contract and
per-commit selection follow [baseline selection](./mokly-derived-baselines.md).
The removed `generatedOutput` and `publicExclude` keys fail `config-invalid`
with guidance to use Git tracking and a referenced asset closure instead.
Only Check, after compilation, uses index paths under `<mockupsDir>/.generated/` to classify
tracked, untracked or mixed output; mixed output fails `build-invalid` with
both remedies as specified in [generated output](./mokly-generated-output.md).
Tracked Check compares the entire tree with disk; untracked Check ignores
local output. Build writes transactionally. Serve and export await preparation
before classification; Serve publishes `preparing` when a rebuild is needed,
then `pending` while classification runs. Cache hits skip `preparing`.
`watch.rules[].paths` and Review `sharedImpact` are repository-relative POSIX
globs, while stylesheet `match` matches catalogue routes. `repoRoot` defaults to the config directory. Duplicate stylesheet
matches and watch paths are invalid. Additional watch rules cannot override
configured source/module rebuilds, reloads for configured stylesheets and
referenced resources, or package-owned ignores for dependency, build, test,
Review, `.generated/`, and transaction paths. Hand-written public HTML under
`mockupsDir` is not a supported publication surface.
The repository's `.mokly-cache/` and its physical aliases are always private
and ignored before source exceptions or broad globs, and cannot be configured
as an entry glob root, mockups, Review output, or an export destination.
Two layouts are recommended. A sibling layout for a repository-root config
uses `entriesDir: "docs/mockups/entries"`, `mockupsDir: "docs/mockups"`,
and `renderer: "docs/mockups/renderer.tsx"`; authored assets live in the
catalogue and only referenced assets are public. README and tsconfig files
can live beside the renderer and entry sources without being published. A
co-located layout keeps each entry module beside the product component or
screen it describes, for example `entries: ["src/**/*.mockup.{ts,tsx}"]` with
the same `mockupsDir` and renderer. The `.mockup.ts` and `.mockup.tsx` names are
the recommended convention selected by that example glob, not an additional
runtime suffix rule. Both layouts are examples, not runtime defaults.
Authored source directories and entry modules may sit below `mockupsDir` for a
`docs/mockups/src` layout. They remain inventoried protected inputs rather than
public assets. When `entriesDir` supplies the entry set, its root may equal
`mockupsDir`, but may not be inside `.generated/`; glob-matched modules may
sit directly below `mockupsDir`. Generated routes are confined to `.generated/`.
Review output must not overlap an entry
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
walk within one compilation. Builds replace the entire `.generated/` tree;
no ownership header, glob-based owner check or retired-file exception is
needed. Registry attribution still accepts only a resolved entry module or
inventoried source.

A matched barrel that re-exports another matched module's registry array fails
with `duplicate-id`. Narrow the glob, rename the barrel so the glob no longer
matches it, or stop re-exporting registry arrays.
