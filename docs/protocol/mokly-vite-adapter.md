# Vite Adapter

Status: Storybook's merged setup and the optional file are not available yet. The [Storybook setup milestone](../../plans/storybook-support.md#milestone-32-storybooks-setup-on-the-vite-adapter) adds them.

This page extends the [sidecar bundling contract](./mokly-sidecar.md#bundling)
and the [module source rules](./mokly-sidecar-modules.md). It defines the Vite
adapter for a catalogue with one Storybook folder or none.

## Boundary

The Vite adapter is a second compile path of the `bundle` request. The esbuild
path is the default. When the adapter is off, the esbuild path applies, and no
rule of this page applies. When the adapter is on, Mokly compiles
JavaScript and transforms stylesheets through the project's own Vite setup.
The setup is the Vite configuration that Mokly uses for one side of a
comparison.

Decision: an optional adapter compiles JavaScript and transforms stylesheets
through the project's Vite setup. Vite is Storybook's default builder, and the
adapter removes Mokly's copies of the project's JavaScript and CSS setup.
Rejected: esbuild plugins, an adapter for JavaScript only, Vite for every
project, and webpack and Rspack adapters.

## The `vite` Field

The top-level `vite` field of the [configuration](./mokly-configuration.md) is
`true`, `false`, or an object. `true` or an object turns the adapter on.
`false` or no field keeps the esbuild path. The optional `config` field of the
object is a config-relative path to the [optional file](#the-optional-file).
Without `config`, Mokly uses no optional file, as for `renderer` and
`postcss`. `config` follows the path rules of the other
[filesystem fields](./mokly-configuration.md#shape), including the
[traversal rejection](./mokly-configuration.md#validation).

The field is a bundle setting. A change to it gives a new generation and moves
every
[render input key](./mokly-watch.md#invalidation-through-the-render-graph).
Each side reads the field from its own configuration.

## Loading Vite

`vite` resolves from the side's configuration directory through the side's
selected installation, as React does under the
[bundling rules](./mokly-sidecar.md#bundling). Mokly ships no Vite.
`@mokly/mokly` declares an optional peer dependency on `vite` that names the
supported range. CI tests that range.

When the side cannot load `vite`, `bundle` fails with `bundle-failed`, and its
message names `vite`, as for a missing
[`@storybook/react`](./mokly-sidecar.md#storybook). Decision: a missing `vite`
fails the bundle. A warning and an esbuild compile were rejected, because the
output could then differ from the project's build with no clear failure.

After `vite` loads, a failure to load the setup or to run Vite fails `bundle`
with `bundle-failed`. Its message names the installed Vite version and the
tested range. Decision: Mokly adds no version check. A version check was
rejected, because it adds a new error.

## The Setup

One setup compiles every JavaScript entry of a side: each entry module, each
stories file, the renderer, and the Storybook preview. With a Storybook
folder, Mokly loads Storybook's merged Vite setup for every JavaScript entry.

Without a Storybook folder, Mokly loads the app setup for every JavaScript
entry. The app setup comes from the first Vite config file that Vite's own
lookup finds in the configuration directory. The lookup uses Vite's file names
and order. Without such a file, Vite's defaults apply. Mokly loads every
config file that Vite's default config loader accepts, in ES module or
CommonJS form.

Decision: one setup compiles every JavaScript entry, and a Storybook folder
selects Storybook's merged setup. Stories then match Storybook, and each module
loads once. Rejected: the app setup for every catalogue, a setup file that the
project writes, and two setups.

Mokly loads the setup with Vite's command `serve` and Vite's mode
`development`, for every Mokly command and on both sides. The Vite root is the
configuration directory, unless the setup sets a root. Decision: one command
and one mode give one render behaviour for Serve, `build`, and both sides. The
development JSX runtime also gives invocation source. A Vite command and mode
that follow the Mokly command were rejected, because Serve and `build` could
then render differently.

### The Optional File

`vite.config` names the optional file. Its default export comes from
`defineMoklyVite` of `@mokly/mokly/vite`. The default export receives the
loaders `app()` and `storybook()`, which load the app setup and Storybook's
merged setup. Each loader loads its setup only when the default export calls
it. The default export returns the one setup that Mokly uses for a catalogue
with one Storybook folder or none.

Decision: the optional file lets a project avoid a broken Storybook release.
Storybook's merged setup without the optional file was rejected.

## The Vite Server

Mokly runs every setup, also a setup that the optional file returns, under
these rules:

- Vite runs with no HTTP server, no hot module replacement, no file watcher,
  and no dependency pre-bundling.
- Mokly's use of Vite writes no file, also no temporary config bundle and no
  cache directory.
- Modules run in Vite's server environment, with the resolve options of that
  environment and Vite's server conditions.

Each sidecar process runs one Vite server for its source root. The plugins of
the setup keep the consumer build's trust, as consumer PostCSS does under the
[sidecar security rules](./mokly-sidecar.md#security).

## Mokly's Plugin

Mokly adds its own Vite plugin, named `mokly`, to every setup. The plugin
handles the items below. Each item keeps its rule from the esbuild path,
except the class map of a CSS Module. The plugin handles each import in this
list before every plugin of the setup:

- the virtual entry, which exports every entry module, stories file, the
  renderer, and the Storybook preview, under the
  [module source rules](./mokly-sidecar-modules.md#authoring-and-evaluation);
- the attributed authoring facade for repository-owned importers of
  `@mokly/mokly`, and the unattributed API for installed packages, under the
  same rules;
- Mokly's reserved runtime module: a consumer import of it fails `bundle`;
- `.css` and `.module.css` imports, which give an empty module or the class
  map of the
  [Vite adapter stylesheet rules](./mokly-vite-adapter-styles.md#css-modules),
  and enter the module graph as stylesheets;
- React, React DOM, and the JSX development shim, under the
  [bundling rules](./mokly-sidecar.md#bundling);
- confinement and logical names, under the
  [source and dependency file rules](./mokly-sidecar-modules.md#source-and-dependency-files);
- consumed bytes and the [module graph](#module-graph).

The setup decides the parse and JSX settings of each module, such as
`tsconfig.json` options. The esbuild
[parsing policy](./mokly-sidecar-modules.md#authoring-and-evaluation) does not
apply. The JSX development shim attaches
[invocation source](./mokly-instances.md#optional-invocation-source) when the
setup emits the development JSX runtime.

## Module Graph

Each module that Vite transforms is a module of the graph. It carries the
digest of its consumed bytes and its imports: first its static imports and
re-exports in source order, then its dynamic imports in source order, with
stylesheets among them. Decision: dynamic imports come after static imports,
because a module evaluates every static import first, as in the project's
own Vite build. The esbuild path's interleaved order was rejected under the
adapter. A file that a query selects, such as `?raw`, `?url`, or `?react`,
counts as its file with its bytes. A plugin's virtual module is not a module
of the graph. The files that it imports count as imports of its importer.

A dependency that the setup externalizes is a module of the graph with the
digest of its resolved file and no imports. Node then loads it and its own
imports at evaluation. Files outside the source root and the selected
dependency roots fail closed under the
[confinement rules](./mokly-sidecar-modules.md#source-and-dependency-files).
The diagnostic of a transform or resolution failure names the logical module,
the plugin, and the plugin's message. A failure to load the setup names the
Vite config file or the config import that failed. No Vite diagnostic or
`diagnostic` event shows an absolute path or a virtual module.

## Evaluation And One React Runtime

`bundle` evaluates nothing. `describe` evaluates the virtual entry through
Vite's module runner, after `cssModules` installed the class maps. Each module
of a generation evaluates once. React and React DOM resolve from the side's
configuration directory through the same lookup as any other import, so a
setup alias of `react` or `react-dom` selects the side's one React runtime.
Every module that Vite runs, every dependency that Node loads for it, the JSX
development shim, and the render use that runtime. Decision: a setup alias
selects React. Forcing the default React and ignoring the alias was rejected,
because the esbuild path also lets the side's aliases select React.

## Recipes And Reuse

A Vite compile returns a
[compiled recipe](./mokly-sidecar-recipes.md#compiled-recipe). So
`restoreGeneration` replays it in another process without a read of a current
source file and without a transform. The toolchain identity also digests the
version and the real path of the Vite package.

A Vite compile records no reuse evidence, because Vite's resolver and plugins
do not report the candidates that they probe. So, under the
[reuse rules](./mokly-sidecar-recipes.md#reuse-and-identity), the
[bundle cache](./mokly-base-cache.md#bundle-entries) never stores a Vite
compile, and a `full` request never reuses it. A `serveEdit` request can reuse
a marked Vite compile under the live checks. A Vite compile emits the
[operation event](./mokly-sidecar-recipes.md#operation-events) `vite`, as an
esbuild call emits `esbuild`.

## Replaced Settings

Under the adapter, the setup takes the place of the `postcss` module and of
the `moduleResolution` fields `aliases`, `conditions`, `mainFields`,
`resolveExtensions`, and `loaders`. The setup resolves imports, so Mokly's
[tsconfig `paths` rule](./mokly-sidecar-modules.md#source-and-dependency-files)
does not apply. Decision: the setup replaces these settings, so Mokly keeps no
copy of the project's setup. `packageRoots` still names the dependency roots.
On both sides, the `node_modules` directories of the package roots supplement
the setup's lookup as the last fallback, as on the
[esbuild path](./mokly-configuration.md#module-resolution).

Mokly's `"empty"` opt-outs for `.css` and `.module.css` still apply, and they
cover every stylesheet language. `.css` skips every plain and module
stylesheet. `.module.css` skips every module stylesheet.

Under the adapter, each replaced setting that the configuration holds gives
one `vite-replaced-setting` configuration warning, also when its list or map
is empty. `loaders` is the exception: it gives the warning only when it holds
a key other than `.css` and `.module.css`. `{field}` names the setting, such
as `postcss` or `moduleResolution.aliases`. `{keys}` lists the other keys in
lexical order, each JSON-quoted, joined with `, `. The messages are:

```text
setting "{field}" has no effect under the Vite adapter, because the Vite setup replaces it. Remove it, or move it to the Vite setup.
setting "moduleResolution.loaders" has no effect under the Vite adapter for keys {keys}, because the Vite setup replaces them. Remove those keys, or move them to the Vite setup.
```

The [strict rule](./mokly-build-warnings.md#strict-mode) counts the warning.
Decision: a warning names each setting that has no effect, as the
[warnings contract](./mokly-build-warnings.md#scope) does for an ignored
input. Rejected: no warning, a `config-invalid` failure, and Mokly's aliases
after the setup's own aliases, which would give two alias sources.

## Inputs, Serve, And Stylesheets

The [Vite adapter input rules](./mokly-vite-adapter-inputs.md) define the
inputs of a Vite compile, how Serve rebuilds, and the setup of the base side.
The [Vite adapter stylesheet rules](./mokly-vite-adapter-styles.md) define how
the setup transforms each local stylesheet.

## Related Docs

- [Vite adapter inputs](./mokly-vite-adapter-inputs.md)
- [Vite adapter stylesheets](./mokly-vite-adapter-styles.md)
- [Render sidecar](./mokly-sidecar.md) and
  [sidecar module sources](./mokly-sidecar-modules.md)
- [Compiled recipes and release](./mokly-sidecar-recipes.md)
- [Mokly configuration](./mokly-configuration.md) and
  [imported CSS configuration](./mokly-configuration-imported-styles.md)
- [Imported stylesheet delivery](./mokly-imported-styles.md)
- [Watched catalogue development](./mokly-watch.md)
- [Base source and dependency preparation](./mokly-base-preparation.md)
- [Rust core architecture](../architecture/rust-core.md) and
  [package boundary](../architecture/package-boundary.md)
