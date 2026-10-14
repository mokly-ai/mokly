# Mokly Configuration Contract

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This is the detailed configuration boundary of the
[package contract](./mokly-package.md). It names every field, where each path
resolves, and the validation that rejects an unsafe configuration.

## Configuration Discovery

Mokly searches upward from the current working directory for
`mokly.config.json`, unless `--config` names another JSON file. Discovery
stops at the filesystem root and reports every directory it searched when
none is found. The configuration is data: the core reads it without Node.js,
and no sidecar starts for it.

The config's filesystem paths resolve relative to the config file, never
relative to the installed package or a transient npx cache.
Repository-matching globs operate on repo-relative POSIX paths. The core validates
the file against the JSON Schema that the package ships as
`@mokly/mokly/config.schema.json`; a `$schema` property that names it gives
editors completion and inline validation. The schema and the core accept the
following contract:

- `roots`: the directories Mokly scans for HTML screens, components, pages,
  use cases, Markdown documents, entry modules, and stories files, each with
  optional file globs, a path prefix, and transparent directory names,
  defaulting to one `specs` root;
- `repoRoot`: the repository root, defaulting to the config file's directory;
- `colorSchemes`: a light-only or light-and-dark rendering set;
- `renderer`: the optional module that wraps React screen and component
  renders with the product's providers;
- `stylesheets`: declarative route-to-stylesheet rules;
- `postcss` and `moduleResolution`: the consumer's PostCSS module and the
  package roots, aliases, conditions, fields, extensions, and loaders that the
  [sidecar](./mokly-sidecar.md) bundles with;
- `review.base`: the Git ref whose merge base with `HEAD` is the comparison
  base;
- `watch`: additional authored inputs and static assets for watched Serve.

The resolved config has one repository root, one sorted resolved source-file
set across every root, and normalized repo-relative POSIX paths. No field names
an output directory, because no command writes into the repository: `build`
takes its output directory from `--out` under the
[static build contract](./mokly-export.md), `mokly-static/` at the repository
root by default, which Git must ignore, and `publish` builds into its own
directory outside the repository. The render cache is process memory, and the
base-side caches live in the operating system's cache directory under the
[architecture page](../architecture/rust-core.md#render-graph).

No default may encode `docs/mockups` as a mandatory location, product route
families, consumer design tokens, email-template paths, or a TypeScript
workspace layout. A conventional layout may be offered by an explicit
initializer or documented example, not hidden in runtime logic.

## Shape

The normative configuration shape is:

```ts
type ColorScheme = "dark" | "light";

type SharedStylesheet = string; // a stylesheet, or the "$componentStylesheets" token

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
  files?: readonly string[]; // the default globs of the root field contract
  path?: string; // prefix for every derived path; none by default
  transparent?: readonly string[]; // directory names removed from paths
}

interface MoklyConfig {
  colorSchemes?: readonly ColorScheme[]; // ["light"]
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
  };
  watch?: {
    debounceMs?: number; // 75
    rules?: readonly {
      action: "ignore" | "rebuild" | "reload";
      paths: readonly string[];
    }[];
  };
}
```

Filesystem fields (`repoRoot`, `roots[].dir`, `renderer`, `postcss`, module
resolution package roots, and local stylesheet paths) are config-relative.
`roots[].files` globs are relative to their root; `watch.rules[].paths` are
repository-relative POSIX globs; a stylesheet `match` matches catalogue
routes. HTTP(S) stylesheet URLs are allowed. `colorSchemes` is a non-empty,
duplicate-free subset of `"light" | "dark"` that must include `"light"`; it
defaults to `["light"]` and normalizes to light-first order.

Shared `stylesheets` apply to every screen and component view of a matching
route, with a matching `lightStylesheets` or `darkStylesheets` list appended
in declaration order; pages link their own CSS. The shared list may contain
the `$componentStylesheets` token once; scheme-specific lists cannot contain
it. A `$`-prefixed string in a stylesheet list is a token, and this is the
only token. It places validated component-declared CSS links at that point; by
default they follow shared and precede scheme-specific links. The
[component stylesheets contract](./mokly-component-stylesheets.md) owns the
validation and placement rules, and
[imported CSS configuration](./mokly-configuration-imported-styles.md) owns
`postcss`, the loader boundary, and the bundling model.

## Validation

Configuration accepts only the declared fields. An undeclared field fails with
`config-invalid` and `unknown configuration field: <field>`; no removed field
has a warning or a migration. Validation also rejects, with `config-invalid`
naming the setting and the path:

- path traversal, and a `dir`, `renderer`, `postcss`, package root, or local
  stylesheet outside `repoRoot`, including through symlinks;
- duplicate stylesheet `match` values and duplicate watch paths;
- a `$`-prefixed stylesheet string other than `$componentStylesheets`, or that
  token in a scheme-specific list or more than once;
- a watch path that cannot be classified safely;
- a `moduleResolution` value outside the
  [module resolution contract](./mokly-configuration-discovery.md#module-resolution).

Additional watch rules cannot override the package-owned classifications: the
rebuild of configured sources and modules, the reload for configured and
component-declared stylesheets and referenced resources, and the ignores for
dependency, build, test, and output directories, under the
[watch contract](./mokly-watch.md). Referenced authored HTML and other assets
become public only through the [referenced closure](./mokly-public-closure.md);
an authored HTML file is a catalogue entry only as a `.page.html` file or
through `definePage`.

## Git Boundary

Before reading Git, `repoRoot` must resolve through symlinks to the same path
as `git rev-parse --show-toplevel` run from that directory. A nested root fails
with `config-invalid`, naming both paths. This validation belongs to the Git
boundary, not to unconditional config loading: Serve without a comparison and
`build` without Changes work without Git, and an explicit comparison request
keeps the configuration error. Missing refs or history keep their
command-specific errors. `publish` requires a clean checkout under the
[upload contract](./mokly-upload.md). Serve, `build`, and Changes validate
before their first Git read.

## Layout

The recommended layout is a dedicated spec tree: the default root `specs`
holds screens, pages, documents, and use cases by product area, with
`renderer: "specs/renderer.tsx"` when React screens need providers. A
component library adds a second root over its source tree, such as
`{ dir: "packages/ui/src", path: "components" }`, so component mockups stay
beside component code. The documented alternative co-locates every mockup
beside the product code it describes, for example
`{ dir: "src/features", transparent: ["__mockups__"] }`; both layouts produce
the same catalogue paths under the [path contract](./mokly-paths.md). The
`.mockup.ts`, `.mockup.tsx`, `.screen.html`, `.component.html`, `.page.html`,
`.use-case.yaml`, and `.stories.*` names are the suffixes the default `files`
globs select; the file kinds are those of the
[HTML screens contract](./mokly-html-screens.md#file-kinds-without-javascript).

## Roots

The [root field contract](./mokly-root-discovery.md#root-fields) defines the
strict `dir`, `files`, `path`, and `transparent` fields and their defaults.
The [discovery contract](./mokly-configuration-discovery.md) defines
traversal, folder-record ownership, filesystem races, and the source
inventory.

Every matched file belongs to exactly one root. The
[root discovery contract](./mokly-root-discovery.md) defines overlap
diagnostics, including physical aliases. Overlapping directories are valid
when their file sets are disjoint. The
[static build contract](./mokly-export.md) confines the output directory of
`build` against the roots and the repository.
[Imported CSS](./mokly-configuration-imported-styles.md) defines `postcss` and
the loader boundary; public files use the
[referenced closure](./mokly-public-closure.md).
