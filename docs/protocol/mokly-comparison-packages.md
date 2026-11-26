# Comparison Package Selection

Status: Package imports can still select a source for a configured stylesheet. The [configured stylesheet follow-up](../../plans/follow-ups/configured-stylesheet-package-imports.md) covers exact paths for these imports.

This page defines where the [comparison sides](./mokly-comparison.md#sides)
resolve JavaScript and CSS packages. The [dependency contract](./mokly-base-dependencies.md)
defines dependency identities, installs, and fallback reasons.

## JavaScript Package Selection

The [repository mapping](./mokly-sidecar-modules.md#source-and-dependency-files)
keeps repository-owned workspace and local directory packages on the side
being rendered. The [dependency contract](./mokly-base-dependencies.md#dependency-identity)
defines the supported package managers and the installation cache key.
Third-party dependencies follow three tiers:

1. The base's lockfile and manifest identities equal the working tree's under
   Git's clean conversion: the bundle resolves third-party dependencies from the
   working tree's `node_modules` through the module resolution settings. This
   tier needs no install and gives no unsupported-manager warning.
2. They differ: the base's dependencies are installed into a bounded cache
   under the
   [installation rules](./mokly-base-dependencies.md#installation-and-bundle-settings),
   and the bundle resolves third-party dependencies from there.
3. The install cannot run, because the machine is offline, the package manager
   is unsupported, or the time limit passes; the install lacks a used dependency
   directory; or an importer's directory lookup is not mapped: working
   dependencies apply and the `base-dependencies` warning names the selected
   lockfile when one exists and gives the fallback reason.

## Workspace Package Sources

After lookup of a bare package specifier and repository mapping, Mokly
checks for a source file on the side being rendered. This rule applies to
the head and the base. A configured file keeps its exact path, including
when a package import reaches it. This includes local stylesheets named in
the configuration.

1. The target must be a repository path outside `node_modules`. The nearest
   `package.json` above the target, within the repository, must have a
   `name`. Its directory is the package root.
2. Try the layouts of the package in the [layout order](#layout-order). A
   layout maps build folders to source folders inside the package root.
3. For a target under a build folder of a layout, try the same relative path
   under its source folder. When build folders of one layout nest, use the
   longest one that holds the target. For a `.js`, `.mjs` or `.cjs` target,
   replace the extension with each resolve extension that ends in `.tsx`,
   `.ts`, `.jsx`, `.js`, `.mts`, `.cts`, `.mjs`, or `.cjs`, in the
   configured order. For other targets, keep the file name.
4. Load the first matching regular source file on that side. If no layout
   gives one, keep the original target. When Node selects a target for a
   restored runtime require or a synchronous PostCSS require, keep an
   existing build file on the selected side. Use the source rule if that
   side lacks the build file. A missing repository-mapped JavaScript target
   fails with `module {path} has no source in this side`. When a package
   root holds the target, the message also names
   `moduleResolution.sourcePackages`.

When lookup for a bundled JavaScript import fails, Mokly tries each target
of the matched export key. For a package without `exports`, it tries the
declared main fields for an import of the package root. It skips TypeScript
declaration targets. The lookup succeeds when the layout order maps all
remaining targets to the same source file. Otherwise Mokly keeps the native
error. For requires loaded by Node, a native lookup invokes this recovery
only after `MODULE_NOT_FOUND`.

## Layout Order

The working configuration is the `mokly.config.json` of the working tree,
and the base configuration is the same file in the base commit. An entry of
[`moduleResolution.sourcePackages`](./mokly-configuration.md#source-packages)
applies to the package whose `package.json` `name` equals its key. A side
that holds no such package outside `node_modules` ignores the entry and gives
no warning. Decision: a key is a package name. A folder key was rejected,
because it stops matching the base when a pull request moves the package
folder.

Each side tries the layouts of a package in this order:

- The base tries the entry of the base configuration, then the entry of the
  working configuration, then the detected layout.
- The head tries the entry of the working configuration, then the detected
  layout.

A configuration without an entry for the package adds no layout. The first
layout that gives a source file wins. An entry `false` ends the order where
it stands, and the side keeps the original target. So a base whose own entry
is `false` keeps its build files, also when the working entry names folders.
An entry with folders is one complete layout, and Mokly adds no detected
folder to it, so the entry shows the whole layout in one place.

Decision: the base tries its own entry, then the working entry, for each
file. Only the base's own entries were rejected, because the pull request
that adds an entry would then lose Changes when its base already imports the
package. One entry for each package was rejected, because a pull request
could then not correct a wrong entry of its base.

The detected layout reads `outDir` and `rootDir` from the package root's
`tsconfig.json` and its relative `extends` files in the repository outside
`node_modules`. An unreadable reference makes both inherited folders unknown.
Later references and local compiler options can supply them. When both are
known and both stay inside the package root, `outDir` is the build folder and
`rootDir` is its source folder. Otherwise `dist`, `lib`, `build` and `out`
directly under the package root are build folders, each with the source
folder `src`.

## Ignored Modules

When Changes runs, Mokly gives one `ignored-module` configuration warning for
each repository file outside `node_modules` that Git ignores and that a
bundled import or a CSS `@import` of the head loads. Changes runs in `build`
and `publish` without `--no-changes`, and in Serve when it classifies
Changes. A later base renders from the files that Git tracks, so it cannot
load such a file. `{path}` is the repository-relative POSIX path.
`{package}` is the workspace package's `package.json` name.

- Inside a workspace package, the message is `module {path} is ignored by Git, so a later base cannot load it; set moduleResolution.sourcePackages for {package}`.
- Outside a workspace package, the message is `module {path} is ignored by Git, so a later base cannot load it`.

A file that Git neither tracks nor
ignores gives no warning, because a commit can still add it. A file that Node
loads for a require gives no warning, because the base recovers its source
after `MODULE_NOT_FOUND`. [Strict mode](./mokly-build-warnings.md#strict-mode)
counts the warning.

Decision: Mokly warns about each ignored file that the head loads, so the
author learns of a missing entry before the merge. A warning for each entry
that loads no source file was rejected, because it misses an entry that the
author forgot.
