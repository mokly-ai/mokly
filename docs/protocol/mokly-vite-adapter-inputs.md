# Vite Adapter Inputs

Status: The optional file and the Vite stylesheet transform are not available yet. The [Storybook setup milestone](../../plans/storybook-support.md#milestone-32-storybooks-setup-on-the-vite-adapter) adds the optional file, and the [stylesheet milestone](../../plans/storybook-support.md#milestone-16-stylesheets-through-vite) adds the transform.

This page continues the [Vite adapter contract](./mokly-vite-adapter.md). It
defines the inputs of a Vite compile, how Serve rebuilds, and the setup of the
base side.

## Inputs And Serve

These files are inputs of a Vite compile, present or absent:

- the Vite config file, the optional file, and the files that they import;
- the env files that Vite reads;
- each file that a plugin of the setup loads with `this.load` or reports with
  `this.addWatchFile` while Vite transforms a module, also when an import
  makes the file a module of the graph.

A change to one of them causes a rebuild, reloads the setup, and moves every
[render input key](./mokly-watch.md#invalidation-through-the-render-graph).
In Serve, Mokly's watcher drives every rebuild. A `bundle` request never uses
a transform of older bytes than the bytes that the graph reports.

A plugin's report of a file outside the source root and the selected
dependency roots is skipped with a sidecar
[`diagnostic` event](./mokly-sidecar.md#transport).

Each file that a `composes` of a CSS Module reads is an input of that CSS
Module, also when no plugin reports the file. A change to the file has the
same effect as an edit of that CSS Module.

A file that a plugin of the setup writes is a watched change like any other
edit. Decision: Mokly makes no exception for these writes. The plugins of the
setup keep the consumer build's trust, as PostCSS plugins do.

## The Base Side

The base side compiles JavaScript and transforms stylesheets with the base
commit's setup in its extraction. That setup comes from the base
configuration's own `vite` field, optional file, Vite config file, and env
files, all from the base commit. `vite` resolves through the base side's
selected installation, under the
[dependency tiers](./mokly-comparison.md#sides). The imports of installed
packages in the setup and every bare import of a base module resolve the same
way.

## Related Docs

- [Vite adapter](./mokly-vite-adapter.md) and
  [Vite adapter stylesheets](./mokly-vite-adapter-styles.md)
- [Watched catalogue development](./mokly-watch.md)
- [Render sidecar](./mokly-sidecar.md)
- [Tree comparison and changes](./mokly-comparison.md)
- [Base source and dependency preparation](./mokly-base-preparation.md)
