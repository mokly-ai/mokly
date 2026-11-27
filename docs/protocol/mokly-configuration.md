# Mokly Configuration Contract

Status: The `vite.config` field is not available yet. The [Storybook setup milestone](../../plans/storybook-support.md#milestone-32-storybooks-setup-on-the-vite-adapter) adds it.

This page defines the fields, path resolution, and validation of the
[package contract](./mokly-package.md).

## Configuration Discovery

Mokly searches upward from the current working directory for
`mokly.config.json`, unless `--config` names another JSON file. Discovery
stops at the filesystem root and reports every directory it searched when
none is found. The configuration is data: the core reads it without Node.js.
No sidecar starts for it, except to read the `main.*` of a root without `dir`
under the [roots from `main.*` rules](./mokly-root-discovery.md#roots-from-main).

Repository-matching globs operate on repo-relative POSIX paths. The core validates
the file against the JSON Schema that the package ships as
`@mokly/mokly/config.schema.json`; a `$schema` property that names it gives
editors completion and inline validation. The schema and the core accept the
following contract:

- `roots`: the directories Mokly scans for HTML screens, components, pages,
  use cases, Markdown documents, entry modules, and stories files, each with
  optional file globs, a path prefix, transparent directory names, and a
  [Storybook folder](./mokly-storybook.md#storybook-folders), defaulting to
  one `specs` root;
- `repoRoot`: the repository root, defaulting to the config file's directory;
- `colorSchemes`: a light-only or light-and-dark rendering set;
- `renderer`: the optional module that wraps React screen and component
  renders with the product's providers;
- `stylesheets`: declarative route-to-stylesheet rules;
- `postcss` and `moduleResolution`: the consumer's PostCSS module and the
  package roots, aliases, conditions, fields, extensions, loaders, and
  workspace package layouts that the [sidecar](./mokly-sidecar.md) bundles with;
- `vite`: `true`, `false`, or an object with an optional `config` path,
  which controls the [Vite adapter](./mokly-vite-adapter.md), off by default;
- `review.base`: the Git ref whose merge base with `HEAD` is the comparison
  base, defaulting to `origin/main`;
- `review.baseInstallScripts`: whether base dependency installs run lifecycle
  scripts, defaulting to false;
- `watch`: additional authored inputs and static assets for watched Serve,
  and the watch debounce `watch.debounceMs` in milliseconds, defaulting to 75.

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

The shipped [configuration schema](../../packages/mokly/config.schema.json)
defines the normative shape: every field, its type, and its accepted values.
The rules below define how Mokly resolves and applies the fields.

Filesystem fields resolve from the configuration directory in both trees.
They include `repoRoot`, `roots[].dir`, `roots[].storybook`, `renderer`,
`postcss`, `vite.config`, package roots, and local stylesheet paths.
Mokly removes `.`, `..`, and empty segments before resolving symbolic links,
so `link/../ui` names `ui`.
Equivalent spellings behave the same in every command. A validation message
repeats the authored value. Other messages use paths without `.` or `..`.
This order gives each field one meaning in the core, in the sidecar, and
on both sides of a comparison.

After validation, each use of `renderer` and `postcss` names the resolved
repository-relative file, including in messages. Resolving symbolic links
matches the paths of modules and their stylesheets in the sidecar graph.

`roots[].files` globs are relative to their root. `watch.rules[].paths` are
repository-relative POSIX globs. A stylesheet `match` applies to catalogue
entry routes of the form `path/index.html`. For the origin of
`moduleResolution.sourcePackages` folders, see [Source Packages](#source-packages).

Globs are case-sensitive POSIX globs:
`*` does not cross `/`, and `**` can cross directories. Stylesheet matchers
accept brace alternatives and character classes. A backslash does not escape
a character. Root-file validation and expansion apply to `roots[].files`.
An extglob opening (`@(`, `!(`, `+(`, `*(`, or `?(`) outside a character class
produces one `stylesheet-extglob` configuration warning per matcher. Its message is:

```text
stylesheet match <JSON-quoted-pattern> uses unsupported extglob syntax. Use brace alternatives such as "{a,b}" instead.
```

The warning leaves matching unchanged. Normal [strict warning handling](./mokly-build-warnings.md#strict-mode) applies.
The first matching stylesheet rule applies.
HTTP(S) stylesheet URLs are allowed. `colorSchemes` is a non-empty,
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

Mokly keeps the last value of a repeated JSON key.
Configuration accepts only the declared fields. An undeclared field fails with
`config-invalid` and `unknown configuration field: <field>`; no removed field
has a warning or a migration. Validation also rejects, with `config-invalid`
naming the setting and the path:

- path traversal in `dir`, `storybook`, `renderer`, `postcss`, `vite.config`,
  package roots, or local stylesheets. Both lexical and real paths must stay
  inside the real `repoRoot`, including paths with `..` segments. Under Vite,
  `postcss` needs only the lexical check.
- a named Storybook folder that is not an existing directory, naming
  `roots[<index>].storybook`, as for `dir`.
- duplicate stylesheet `match` values and duplicate watch paths;
- a `$`-prefixed stylesheet string other than `$componentStylesheets`, or that
  token in a scheme-specific list or more than once;
- a watch path that cannot be classified safely;
- a `moduleResolution` value outside the
  [module resolution rules](#module-resolution) below, including an invalid
  [source package](#source-packages) entry.

Path traversal uses one limit for every field. A second limit at the lexical
path of `repoRoot` was rejected, because a directory could then pass for one
field and fail for another.

An invalid source package entry fails as every other `moduleResolution` value
does. A warning that skips the entry was rejected, because a folder outside
the package root is unsafe, not only wrong.

Additional watch rules cannot override the package-owned classifications: the
rebuild of configured sources and modules, the reload for configured and
component-declared stylesheets and referenced resources, and the ignores for
dependency, build, test, and output directories, under the
[watch contract](./mokly-watch.md). Referenced authored HTML and other assets
become public only through the [referenced closure](./mokly-public-closure.md);
an authored HTML file is a catalogue entry only as a `.page.html` file or
through `definePage`.

## Git Boundary

Before a Git read, `repoRoot` must resolve through symlinks to the path that
`git rev-parse --show-toplevel` gives from that directory. A nested root fails
with `config-invalid` and names both paths. Serve without a comparison and
`build` without Changes work without Git. An explicit comparison keeps the
configuration error. Missing refs or history keep their command-specific
errors. `publish` requires a clean checkout under the
[upload contract](./mokly-upload.md).

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

The [root field contract](./mokly-root-discovery.md#root-fields) defines
`dir`, `files`, `path`, `transparent`, `storybook`, and their defaults.
A root needs `dir` unless it names a Storybook folder and takes its
[directories from `main.*`](./mokly-root-discovery.md#roots-from-main).
The [root discovery contract](./mokly-root-discovery.md#traversal-and-ownership)
defines traversal, folder-record ownership, filesystem races, and the source
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

## Module Resolution

`moduleResolution` has no defaults beyond esbuild's platform behaviour in the
[sidecar](./mokly-sidecar.md#bundling) and the default delivery of
[JavaScript asset imports](./mokly-imported-assets.md#imported-types). Package roots must be in-repository
directories containing `package.json`; their `node_modules` directories
supplement consumer lookup. Alias keys and targets accept bare package
specifiers only. JavaScript and CSS apply one longest-key alias substitution.
Alias targets resolve from the
configuration directory through Node's ancestor lookup, then the configured
package roots.
Conditions, package fields, and extensions are ordered,
deduplicated lists: duplicate values are removed and the first occurrence
keeps its position. Loader keys are extensions and values are supported JavaScript-safe
esbuild loader names. The `css` loader is rejected for every extension because
it would emit an undelivered sibling stylesheet. React and React DOM resolve
from the consumer through the sidecar's bundle, so these options cannot
introduce a second React runtime. For the base side of a comparison the
settings name the ancestor and explicit `node_modules` directories that the
[dependency tiers](./mokly-comparison.md#sides) chose. Each importer starts at its
matching directory, including outside-configuration and nested workspace imports.
Configuration ancestors and explicit package roots provide fallback lookup.
An unmappable lookup or a used directory missing from the base installation produces a `base-dependencies` warning naming its directory.

Mokly applies the
[workspace package source rule](./mokly-comparison-packages.md#workspace-package-sources)
automatically after module lookup, on both compile paths. On the esbuild
path, for JavaScript targets, the rule keeps the `resolveExtensions` order
and tries only extensions with a script suffix.

The [Vite adapter](./mokly-vite-adapter.md#replaced-settings) names the
settings of this section that the project's Vite setup replaces.

### Source Packages

`sourcePackages` adds layouts to the
[layout order](./mokly-comparison-packages.md#layout-order) of the workspace
package source rule.
Each key is a bare package name, such as `@acme/ui`. Each entry is `false`,
which ends the layout order with the original target, or a map from build
folder to source folder, such as `{ "esm": "source", "cjs": "source" }`.
Folders are POSIX paths relative to the package root, such as `esm` or
`dist/esm`. Mokly reads `./esm` and `esm/` as `esm`. A source folder can be
`.`, for sources at the package root. Validation rejects a key that is not a
bare package name, an empty map, and a build folder `.`, which would hold
every file of the package. It also rejects a folder that is empty or
absolute, or that has a `..` or `node_modules` segment. It also rejects an
entry that names one build folder twice after normalization, such as `esm`
and `./esm`. One pair with role names, such as
`{ "dist": "esm", "src": "source" }`, was rejected, because it cannot state a
second build folder.
