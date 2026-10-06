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
  generatedOutput?: "committed" | "derived"; // "derived"
  mockupsDir: string;
  roots?: readonly RootConfig[]; // [{ dir: "specs" }]
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
    stylesheets: readonly SharedStylesheet[];
    lightStylesheets?: readonly string[];
    darkStylesheets?: readonly string[];
  }[];
  review?: {
    base?: string; // origin/main; merge base with HEAD
    baselineBuild?: readonly (readonly string[])[]; // derived mode only
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
  compatibility?: {
    transformer?: string;
  };
}
```

Filesystem fields (`repoRoot`, `roots[].dir`, `mockupsDir`, `renderer`,
compatibility transformer, module-resolution package
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
`watch.rules[].paths` are repository-relative POSIX globs, while stylesheet
`match` matches catalogue routes. `repoRoot` defaults to the config directory. Duplicate stylesheet
matches and watch paths are invalid. Additional watch rules cannot override
configured source/module rebuilds, reloads for configured and declared stylesheets and
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

### Removed Review Setting

A present removed `review.sharedImpact` key, even with `undefined`, emits
`removed-shared-impact` with a configuration subject and exactly
`review.sharedImpact has been removed; ignoring it. Delete the field.`
It adds no watched paths or evidence. [Build Warnings](./mokly-build-warnings.md) owns strict rejection. The public `sharedImpact?: never` rejects values,
including spreads and objects with other review keys. Rejecting explicit
`undefined` requires `exactOptionalPropertyTypes`; otherwise runtime warns.
Source modules without rendered output or references do not create evidence.
Linked stylesheets, including transitive imports, are attributed by rule under
[CSS change attribution](./mokly-css-attribution.md). A changed stylesheet keeps
a view's dependency evidence only when a changed rule could match its before or
after document, or analysis is unresolved. Otherwise it is examined and excluded.
Unreferenced public files cannot add entries to Changes; linked files retain
the uniform CSS rule membership policy in
[Changes](./mokly-changes.md) and [component attribution](./mokly-component-changes.md).

`moduleResolution` has no defaults beyond esbuild's platform behavior. Package
roots must be in-repository directories containing `package.json`; their
`node_modules` directories supplement consumer lookup. Aliases accept bare
package specifiers only. Conditions, package fields, and extensions are ordered,
deduplicated lists, while loader keys are extensions and values are supported
JavaScript-safe esbuild loader names. The `css` loader is rejected for every
extension because it would emit an undelivered sibling stylesheet. React and
React DOM still resolve through Mokly's
consumer-peer plugin so these options cannot introduce a second React runtime.

Configuration accepts only the declared fields above. An undeclared field fails
with `config-invalid` and `unknown configuration field: <field>`.

## Roots

Root defaults, field validation and overlap errors follow
[root validation](./mokly-root-discovery.md#roots). Discovery follows
[configuration discovery](./mokly-configuration-discovery.md).

[Imported CSS configuration](./mokly-configuration-imported-styles.md) owns PostCSS and reserved outputs.
