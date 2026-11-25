# Vite Adapter Inputs

Status: The optional file is not available yet. The [Storybook setup milestone](../../plans/storybook-support.md#milestone-32-storybooks-setup-on-the-vite-adapter) adds it.

This page continues the [Vite adapter contract](./mokly-vite-adapter.md). It
defines the inputs of a Vite compile, how Serve rebuilds, and the setup of the
base side.

## Inputs And Serve

These files are inputs of a Vite compile, present or absent:

- the Vite config file, the optional file, and the files that they import;
- the env files that Vite reads: `.env`, `.env.local`, `.env.development`, and
  `.env.development.local` in Vite's `envDir`;
- the PostCSS config candidates of Vite's own lookup: each file name that the
  lookup accepts, such as `postcss.config.js` and `package.json`, in each
  directory that the lookup can reach;
- the files that a `watch.rules` entry with the `rebuild` action matches,
  under the [watch rules](./mokly-watch.md#watch-inputs), except the sources,
  modules, and stylesheet inputs that Mokly already classifies;
- each file that a plugin of the setup loads with `this.load` or reports with
  `this.addWatchFile` while Vite transforms a module, also when an import
  makes the file a module of the graph.

A change to one of them causes a rebuild, reloads the setup, and moves every
[render input key](./mokly-watch.md#invalidation-through-the-render-graph). A
file that starts or stops matching a `rebuild` rule is also a change. In
Serve, Mokly prepares again before publication when a rule match stops being
a source, module, or stylesheet input. Mokly's watcher drives rebuilds. A
`bundle` request never uses a transform of older bytes than the bytes that the
graph reports.

Each setup uses one snapshot of the bytes or absence of each dotenv candidate.
The config record includes the file selection probes and the bytes consumed
by the config bundle. A compile fails with the changed input's name
if those observations differ from the final setup snapshot. Module digests
also describe the bytes that their transforms used.

Equal setup inputs use equal render identities on both sides. Their logical
names and digests determine identity independently of the physical read paths.

Vite looks up a PostCSS config unless `css.postcss` is an inline object or
`css.transformer` is `lightningcss`. Only a candidate inside the source root
or a selected dependency root is an input. Vite does not load a PostCSS config
file outside these roots, and the sidecar reports such a file with a
[`diagnostic` event](./mokly-sidecar.md#transport).

Decision: the PostCSS config candidates are inputs without a watch rule, and a
`rebuild` rule makes each other file that the setup reads an input. Rejected:
a record of every file that the setup reads, because Vite reads some files in
native code, and the record then misses them. Rejected: inputs for the PostCSS
config only, because an edit to another file that the setup reads then shows
only after Serve restarts.

A plugin's report of a file outside the source root and the selected
dependency roots is skipped with a sidecar
[`diagnostic` event](./mokly-sidecar.md#transport). Each other file that the
setup reports for a stylesheet is also a protected input under the
[stylesheet rules](./mokly-vite-adapter-styles.md#stylesheet-transforms).

Each file that a `composes` of a CSS Module reads is an input of that CSS
Module, also when no plugin reports the file. A change to the file has the
same effect as an edit of that CSS Module. Such a file is also a protected
input under the
[stylesheet rules](./mokly-vite-adapter-styles.md#stylesheet-transforms).

A file that a plugin of the setup writes is a watched change like any other
edit. Decision: Mokly makes no exception for these writes. The plugins of the
setup keep the consumer build's trust, as PostCSS plugins do.

## The Base Side

The base side compiles JavaScript and transforms stylesheets with the base
commit's setup in its extraction. That setup comes from the base
configuration's own `vite` field, optional file, and Vite config file, all
from the base commit. The `rebuild` rules of the base configuration match
files of the base commit. `vite` resolves through the base side's selected
installation, under the [dependency tiers](./mokly-comparison.md#sides). The
imports of installed packages in the setup and every bare import of a base
module resolve the same way.

An env candidate keeps its own logical path. The base resolves committed
symbolic links at any component of that path, including `envDir`. Both sides
can read a target outside the repository. The base applies the following
precedence rules to the final target.

- A file that the base commit holds comes from the base commit.
- A file that the base commit lacks and the Git index of the working tree
  holds is absent, because the branch adds it.
- Each other file comes from the working tree, present or absent.

Vite merges and expands the values of these files the same way on both sides.
The working-tree reads used by the base setup take part in the
[freshness checks](./mokly-base-preparation.md#freshness-checks) before it
reuses a kept base. An env read outside the configured `envDir` contributes
only to freshness unless the file qualifies as another setup input. Reads
that only the base side makes add no [watch input](./mokly-watch.md#watch-inputs).
An edit to such a file shows in Changes after the next classification.

Decision: the base side reads from the working tree each env file that Git
tracks on neither side. A value that only such a file sets then gives no false
change, for example a value in a Git-ignored `.env.local`. Each branch edit of
a tracked env file still shows. Rejected: every env file from the base commit,
because of those false changes. Rejected: tracked env files only, on both
sides, because Serve then ignores values that `vite dev` uses.

## Related Docs

- [Vite adapter](./mokly-vite-adapter.md) and
  [Vite adapter stylesheets](./mokly-vite-adapter-styles.md)
- [Watched catalogue development](./mokly-watch.md)
- [Render sidecar](./mokly-sidecar.md)
- [Tree comparison and changes](./mokly-comparison.md)
- [Base source and dependency preparation](./mokly-base-preparation.md)
