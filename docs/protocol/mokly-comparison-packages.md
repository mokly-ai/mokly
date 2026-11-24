# Comparison Package Selection

Status: Workspace package source lookup is pending for [CSS imports](../../plans/source-packages.md#milestone-4-css-resolution).

This page defines where the [comparison sides](./mokly-comparison.md#sides)
resolve JavaScript and CSS packages. The [dependency contract](./mokly-base-dependencies.md)
defines dependency identities, installs, and fallback reasons.

## JavaScript Package Selection

Repository-owned packages, including workspaces and local directory packages,
resolve inside the side's own tree. The
[dependency contract](./mokly-base-dependencies.md#dependency-identity)
defines that mapping, the supported package managers, and the installation
cache key. Third-party dependencies follow three tiers:

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

After package lookup and repository mapping, Mokly checks for a source file
on the side being rendered. This rule applies to the head and the base.

1. The target must be a repository path outside `node_modules`. The nearest
   `package.json` above the target, within the repository, must have a
   `name`. Its directory is the package root.
2. Use `outDir` as the build directory and `rootDir` as the source directory
   when the package root's `tsconfig.json` and its `extends` chain set both.
   Both directories must stay inside the package root. Otherwise, use
   `dist`, `lib`, `build` or `out` directly under the package root as the
   build directory and `src` as the source directory.
3. For a target under the build directory, try the same relative path under
   the source directory. For a `.js`, `.mjs` or `.cjs` target, replace the
   extension with each resolve extension in order. For other targets, keep
   the file name.
4. Load the first matching regular source file on that side. If none exists,
   keep the original target. A missing repository-mapped JavaScript target
   fails with `module {path} has no source in this side`.
