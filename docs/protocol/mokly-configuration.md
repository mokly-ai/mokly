# Mokly Configuration Contract

This is the detailed configuration boundary of the
[package contract](./mokly-package.md). Settings below describe current
behavior, including imported CSS and optional PostCSS.

## Delivery Status

Existing settings are implemented, including glob-based entry
discovery through `entries` and the `entriesDir` shorthand delivered by the
[co-located entry discovery plan](../../plans/co-located-entry-discovery.md).
The reserved CSS output directory, CSS delivery, and `postcss` key are
implemented. See [imported stylesheet delivery](./mokly-imported-styles.md) and its
[diagnostics](./mokly-imported-styles-errors.md) for exact reserved-path errors.

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

interface MoklyConfig {
  colorSchemes?: readonly ColorScheme[]; // ["light"]
  entries?: readonly string[]; // exactly one of entries or entriesDir
  entriesDir?: string; // shorthand for [`${dir}/**/*.mockup.{ts,tsx}`]
  generatedOutput?: "committed" | "derived"; // "derived"
  mockupsDir: string;
  publicExclude?: readonly string[]; // extends shipped public exclusions
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
see [entry discovery](./mokly-configuration-discovery.md#entry-discovery). Stylesheet file paths are
relative to `mockupsDir`; HTTP(S) stylesheet URLs are allowed.
`colorSchemes` is a non-empty, duplicate-free subset of `"light" | "dark"`
that must include `"light"`; it defaults to `["light"]` and normalizes to
light-first order. Shared `stylesheets` apply to every generated view, with a
matching `lightStylesheets` or `darkStylesheets` list appended in declaration
order. Generated renderer and entry links follow
those configured links; the built-in renderer has no stylesheet.
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
the same `mockupsDir` and renderer. The `.mockup.ts` and `.mockup.tsx` names are
the recommended convention selected by that example glob, not an additional
runtime suffix rule. Both layouts are examples, not runtime defaults.
Authored source directories and entry modules may sit below `mockupsDir` for a
`docs/mockups/src` layout. They remain inventoried protected inputs rather than
public output. When `entriesDir` supplies the entry set, that shorthand root
must not equal `mockupsDir`; glob-matched modules may sit directly below
`mockupsDir`. Generated routes are collision-checked against every inventoried
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
files to Changes; they retain the existing ownership and membership rules in
[Changes](./mokly-changes.md) and [component attribution](./mokly-component-changes.md).

`moduleResolution` has no defaults beyond esbuild's platform behavior. Package
roots must be in-repository directories containing `package.json`; their
`node_modules` directories supplement consumer lookup. Aliases accept bare
package specifiers only. Conditions, package fields, and extensions are ordered,
deduplicated lists, while loader keys are extensions and values are supported
JavaScript-safe esbuild loader names; the `css` loader is rejected for every
extension because it would emit an undelivered sibling stylesheet. React and React DOM still resolve through Mokly's
consumer-peer plugin so these options cannot introduce a second React runtime.

### Imported CSS configuration

`postcss` optionally names a config-relative local module inside `repoRoot`.
Mokly inventories its local imports, loads consumer plugin packages unbundled,
and isolates plugin state per graph load. PostCSS 8-compatible arrays include
instances, uncalled creators, plain functions and `{ postcss: fn }` objects;
ordered package-name records are also accepted. ESM imports and CommonJS
`require()` use their respective Node resolution conditions. The complete
module format, loading, transform and dependency contract is
[Imported Stylesheet PostCSS](./mokly-imported-styles-postcss.md); exact
diagnostics are in [the error catalogue](./mokly-imported-styles-errors.md).

Mokly owns `.css` and `.module.css` handling. At those keys,
`moduleResolution.loaders` accepts only `"empty"`: `.css` skips both plain and
module CSS, `.module.css` skips only module CSS and its class map. Opted-out
CSS is still inventoried. A `file` loader on another JavaScript-imported
asset fails Build.
`moduleResolution.loaders[".pcss"] = "css"` and every other consumer `css`
loader are rejected at config validation; rename to `.css` or use a
JavaScript-safe loader. An `entries` glob cannot have a static prefix inside
`<mockupsDir>/mokly-generated/`; `entriesDir` and `review.outDir` cannot be
equal to or inside it, and entry discovery skips it for broader globs. Local
`stylesheets` paths and authored inputs cannot live there, including symlink
aliases. Consumer `publicExclude` globs cannot start with literal
`mokly-generated` after brace expansion. Broad globs are allowed, but Build
rejects any generated stylesheet or asset matched by a consumer or default
public exclusion. Consumer public files may live elsewhere below `mockupsDir`.

The `legacy` config key is rejected, including `legacy: undefined`. Register
complete documents explicitly with `definePage` or nested `page`, following the
[source-preserving migration](./mokly-page-migration.md). Historical manifest
compatibility does not restore source discovery or legacy configuration.

The remaining contract is continued in [Configuration Discovery And Exclusions](./mokly-configuration-discovery.md).
