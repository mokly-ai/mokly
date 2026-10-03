# Mokly Configuration Contract

This is the detailed configuration boundary of the
[package contract](./mokly-package.md). These settings describe current behavior.

## Delivery Status

Roots and their defaults, globs, prefixes and transparent directories are
implemented. Matched Markdown files are protected, watched source inputs but
are omitted from compilation; a catalogue needs at least one renderable definition.
Markdown rendering remains planned. Every other setting below is implemented.

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

The obsolete `legacy` config key is rejected, including `legacy: undefined`.
`entries` and `entriesDir` are not configuration fields: a config that sets
them fails as it would for any unknown key, and Mokly carries no migration
message or fallback for them. Register every complete HTML document
explicitly with `definePage`; Markdown documents are discovered through
roots; baseline compatibility never restores old configuration.

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

Every `_folder.json` inside a walked root is also owned by exactly one root,
independently of `files`. Overlapping roots that encounter that record fail with
`config-invalid`: `file <file> is matched by roots[<first>] and roots[<second>]`,
where `<file>` is repository-relative and the indices are in configured order.

The [root discovery contract](./mokly-root-discovery.md) defines physical
confinement, filesystem races and the retained ownership inventory.

Every root must retain a file; otherwise `root matches no file: <dir>` lists
denied and vanished paths, including dropped files, sorted under
`; not searched: <repository-relative paths>`. The union across roots is sorted by repository-relative path. Every matched
entry module or Markdown file belongs to exactly one root, including through
physical aliases. If a file matches two roots after exclusions, discovery fails
with `config-invalid` and exact text `file <path> is matched by roots[<n>] and
roots[<m>]`, naming its repository-relative path and both zero-based root
indices. Overlapping directories remain legal when their file sets are disjoint.
Discovery retains that ownership, so a file derives from the root that selected
it rather than the deepest directory that happens to contain it.

## Public Exclusion Configuration

The [public exclusion contract](./mokly-public-exclusions.md) defines
`publicExclude` defaults, frozen resolution, safe glob validation and matching.
