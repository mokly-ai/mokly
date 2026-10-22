# Comparison Package Selection

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This page defines where the [comparison sides](./mokly-comparison.md#sides)
resolve JavaScript packages. The [dependency contract](./mokly-base-dependencies.md)
defines dependency identities, installs, and fallback reasons.

## JavaScript Package Selection

Repository-owned packages, including workspaces and local directory packages,
always come from the side's own sources. During module resolution, a real
path inside a repository root and outside every `node_modules` directory maps
to the same relative path under the side's source root. A missing mapped file
fails closed with `bundle-failed`. Repository roots name the working tree and,
for an install that copies base sources, that copied base repository root.
This covers npm, pnpm, Yarn and Bun workspaces and local `file:` packages,
while nested `node_modules` keep the selected third-party dependencies.
Third-party dependencies follow three tiers:

1. The base's lockfile and manifest identities equal the working tree's under
   Git's clean conversion: the bundle resolves third-party dependencies from the
   working tree's `node_modules` through the module resolution settings.
2. They differ: the base's dependencies are installed, with lifecycle scripts
   disabled by default and under a time limit, into a bounded cache keyed by all manifest and lockfile paths and bytes,
   the package manager and its version, manager configuration, selected install roots, the scripts mode, and the immutable source
   identity when local packages or workspaces participate, and the bundle resolves
   third-party dependencies from there. When scripts run, the key also includes
   the Node version, operating system, and processor architecture used for the install.
3. The install cannot run, because the machine is offline, the package manager
   is unsupported, or the time limit passes; the install lacks a used dependency
   directory; or an importer's directory lookup is not mapped: working
   dependencies apply and the `base-dependencies` warning names the selected
   lockfile when one exists and gives the fallback reason.

Base dependency installation supports npm, pnpm 10 through 12, Yarn Classic 1, and Yarn
Berry 4 with `nodeLinker: node-modules`. Lifecycle scripts stay disabled unless
`review.baseInstallScripts` or its command-line override enables them. Missing managers, unsupported versions, Bun,
and Yarn Plug'n'Play use tier three with the `base-dependencies` warning.
Plug'n'Play has its own fallback reason because the sidecar lacks its resolver. Equal dependency identities still use tier one without an install or
an unsupported-manager warning. Repository-owned workspace sources retain
their side-local mapping for every package manager.
