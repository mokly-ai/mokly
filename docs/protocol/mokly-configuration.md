# Mokly Configuration Contract

This is the detailed configuration boundary of the
[package contract](./mokly-package.md). These settings describe current
behavior, including imported CSS and optional PostCSS.

## Delivery Status

Uniform CSS membership, independent of configured or declared delivery, is
implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the [source-path removal plan](../../plans/remove-source-path-evidence.md).

The removed `review.sharedImpact` field's type guard below is implemented in
[M28A](../../plans/remove-source-path-evidence.md#milestone-28a-integrate-main-131-and-133).
The generic configuration and spread-input type cases are verified in
[M30](../../plans/remove-source-path-evidence.md#milestone-30-strengthen-tests-the-docs-guard-and-removed-field-types).
The other configuration behavior is implemented.

Roots and their defaults, globs, prefixes and transparent directories are
implemented. Matched Markdown files become document entries. Their sources and
resource inputs remain protected and watched. A catalogue may contain only
documents. Other settings below are implemented.
The reserved CSS output directory, CSS delivery and `postcss` key are
implemented. See [imported stylesheet delivery](./mokly-imported-styles.md)
and [diagnostics](./mokly-imported-styles-errors.md) for exact errors.

## Configuration Discovery

Mokly searches upward from the current working directory for
`mokly.config.ts`, `mokly.config.mts`, `mokly.config.js`, or
`mokly.config.mjs`, unless `--config` is supplied. Discovery stops at the
filesystem root and reports every filename it attempted when none is found.

The config's filesystem paths resolve relative to the config file, never
relative to the installed package or transient npx cache. Repository-matching
globs operate on repo-relative POSIX paths. `defineConfig` validates and types
the following contract:

- `mockupsDir`: catalogue root, with output in its `mokly-generated/` child;
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
- additional authored inputs and static assets for watched Serve;

The resolved config has one repository root, one mockups root, one sorted
resolved source-file set across every root, and normalized repo-relative POSIX
paths. Config
validation rejects path traversal, output outside the repository (including
through symlinks), entry modules inside internal or package-owned private roots,
duplicate rules, and a watch path that cannot be classified safely. An entry
module may be nested below `mockupsDir` as protected authored source, but not
inside `mokly-generated/`, including through aliases. Configured entries, renderer
and package roots in that child fail `config-invalid` with the
setting and path; imported authoring sources fail with their path. See
[generated output](./mokly-generated-output.md).

Before reading Git, `repoRoot` must resolve through symlinks to the same path
as `git rev-parse --show-toplevel` run from that directory. A nested root fails
with `config-invalid`, naming both paths. This validation belongs to config's
Git boundary, not unconditional config loading. Build, Check, Serve and
repository preview without comparisons work without Git. Check reads the index,
never `.gitignore`, and treats no Git as untracked. CLI publish requires a clean
checkout under the [upload contract](./mokly-upload.md). Build and Serve never
decide their behavior from head tracking.
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

type SharedStylesheet = string | typeof componentStylesheets;

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
  mockupsDir: string;
  roots?: readonly RootConfig[]; // [{ dir: "specs" }]
  repoRoot?: string; // config directory
  renderer?: string;
  postcss?: string; // config-relative PostCSS module
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
    stylesheets: readonly SharedStylesheet[];
    lightStylesheets?: readonly string[];
    darkStylesheets?: readonly string[];
  }[];
  review?: {
    base?: string; // origin/main; merge base with HEAD
    baselineBuild?: readonly (readonly string[])[]; // used when baseline needs rebuilding
    outDir?: string; // .context/mokly-review
    sharedImpact?: never;
  };
  watch?: {
    debounceMs?: number; // 75
    rules?: readonly {
      action: "ignore" | "rebuild" | "reload" | "restart";
      paths: readonly string[];
    }[];
  };
}
```

Filesystem fields (`repoRoot`, `roots[].dir`, `mockupsDir`, `renderer`,
module-resolution package
roots, and Review `outDir`) are config-relative. `roots[].files` globs are
relative to their root; `watch.rules[].paths` is
repository-relative; see [roots](#roots). Stylesheet file paths are
relative to `mockupsDir`; HTTP(S) stylesheet URLs are allowed.
`colorSchemes` is a non-empty, duplicate-free subset of `"light" | "dark"`
that must include `"light"`; it defaults to `["light"]` and normalizes to
light-first order. Shared `stylesheets` apply to every generated view, with a
matching `lightStylesheets` or `darkStylesheets` list appended in declaration
order.
The shared list may contain the exported `componentStylesheets` symbol once;
scheme-specific lists cannot contain it. It places validated component-declared
CSS links in rendered screen/component documents at that point; by default
they follow shared and precede scheme-specific links. Pages are unchanged.
See [component stylesheets](./mokly-component-stylesheets.md) for the complete
validation and placement contract.
`review.baselineBuild` is valid in every repository; its argv contract and
per-commit selection follow [baseline selection](./mokly-derived-baselines.md).
The removed keys fail `config-invalid` with their exact guidance:
`generatedOutput was removed; use Git tracking for check and run mokly build to write output`
and `publicExclude was removed; remove it; only referenced authored assets are public`.
Check, after compilation, uses index paths under `<mockupsDir>/mokly-generated/` to classify
tracked, untracked or mixed output; mixed output fails `build-invalid` with
both remedies as specified in [generated output](./mokly-generated-output.md).
Tracked Check compares the entire tree with disk; untracked Check ignores
local output. Publish separately validates committed or ignored generated output.
Build writes transactionally. Serve and export await preparation
before classification; Serve publishes `preparing` when a rebuild is needed,
then `pending` while classification runs. Cache hits skip `preparing`.
`watch.rules[].paths` are repository-relative POSIX globs, while stylesheet
`match` matches catalogue routes. `repoRoot` defaults to the config directory. Duplicate stylesheet
matches and watch paths are invalid. Additional watch rules cannot override
configured source/module rebuilds, reloads for configured and component-declared stylesheets and
referenced resources, or package-owned ignores for dependency, build, test,
Review, `mokly-generated/`, and transaction paths. Referenced authored HTML under `mockupsDir` is a checked
closure asset and can be served and exported. It is not a catalogue entry
unless registered with `definePage`.
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
directory must not equal `mockupsDir`; matched files may sit below it. The generated tree cannot contain authored sources, including through aliases. Review output must not overlap an entry
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

### Removed Review Setting

The [removed setting contract](./mokly-configuration-discovery.md#removed-review-setting)
owns runtime warnings, no-effect handling and the TypeScript guard.

The [module resolution contract](./mokly-configuration-discovery.md#module-resolution)
owns package roots, aliases, ordered lists, loaders and consumer React identity.

Export rejects a consumer package root equal to `mockupsDir` after realpath
resolution, with `export-invalid`; config loading adds no equality rejection.
The [public-file policy](./mokly-public-closure.md) defines the exact error.

The removed `compatibility` key is rejected even when its value is `undefined`,
with `compatibility was removed; author portable links directly`.
The obsolete `legacy` config key is rejected, including `legacy: undefined`.
Register every complete document explicitly with `definePage`;
baseline compatibility never restores source discovery or old configuration.

Configuration accepts only the declared fields above. An undeclared field fails
with `config-invalid` and `unknown configuration field: <field>`.

## Roots

The [root field contract](./mokly-root-discovery.md#root-fields) defines the
strict `dir`, `files`, `path` and `transparent` fields and their defaults.

The [discovery contract](./mokly-configuration-discovery.md) defines traversal,
folder-record ownership, filesystem races and the retained source inventory.

Every matched entry module or Markdown file belongs to exactly one root.
The [root discovery contract](./mokly-root-discovery.md) defines overlap
diagnostics, including physical aliases. Overlapping directories are valid
when their file sets are disjoint. [Imported CSS](./mokly-configuration-imported-styles.md)
defines `postcss` and reserved output; public files use the
[referenced closure](./mokly-public-closure.md).
