# Comparison Package Selection

This page defines where the [comparison sides](./mokly-comparison.md#sides)
resolve JavaScript packages. The [dependency contract](./mokly-base-dependencies.md)
defines dependency identities, installs, and fallback reasons.

## JavaScript Package Selection

Repository-owned packages, including workspaces and local directory packages,
always come from the side's own sources. The
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
