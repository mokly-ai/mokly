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
2. Read `outDir` and `rootDir` from the package root's `tsconfig.json` and
   its relative `extends` files in the repository outside `node_modules`.
   An unreadable reference makes both inherited folders unknown. Later
   references and local compiler options can supply them. Use `outDir` as
   the build directory and `rootDir` as the source directory when both are
   known and both stay inside the package root. Otherwise, use `dist`,
   `lib`, `build` or `out` directly under the package root as the build
   directory and `src` as the source directory.
3. For a target under the build directory, try the same relative path under
   the source directory. For a `.js`, `.mjs` or `.cjs` target, replace the
   extension with each resolve extension that ends in `.tsx`, `.ts`, `.jsx`,
   `.js`, `.mts`, `.cts`, `.mjs`, or `.cjs`, in the configured order.
   For other targets, keep the file name.
4. Load the first matching regular source file on that side. If none exists,
   keep the original target. When Node selects a target for a restored
   runtime require or a synchronous PostCSS require, keep an existing build
   file on the selected side. Use the source rule if that side lacks the
   build file. A missing repository-mapped JavaScript target fails with
   `module {path} has no source in this side`.

When lookup for a bundled JavaScript import fails, Mokly tries each target
of the matched export key. For a package without `exports`, it tries the
declared main fields for an import of the package root. It skips TypeScript
declaration targets. The lookup succeeds when all remaining targets map to
the same source file. Otherwise Mokly keeps the native error. For requires
loaded by Node, a native lookup invokes this recovery only after
`MODULE_NOT_FOUND`.
