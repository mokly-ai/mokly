# Mokly Shim And Native Runtime Inputs

The [package contract](./mokly-package.md) defines the packages and the
supported Node range. This page defines what the `mokly` Node shim passes to
the native binary, and how the binary finds its Node inputs.

## Native Runtime Inputs

The shim passes `MOKLY_PACKAGE_ROOT` as the executing `@mokly/mokly` package
root and `MOKLY_NODE_EXECUTABLE` as its `process.execPath`. The binary starts
`dist/sidecar.js` from that package with the resolved repository as its working
directory. An HTML-only catalogue without a renderer or configured PostCSS needs neither
Node nor a sidecar entry. Configured PostCSS starts a sidecar when the CSS
pipeline processes a stylesheet. Direct binary execution uses `node` from
`PATH` when `MOKLY_NODE_EXECUTABLE` is absent. It first checks the adjacent installed package, then
walks invocation-directory and executable ancestors for
`node_modules/@mokly/mokly/dist/sidecar.js` or `packages/mokly/dist/sidecar.js`.
These inputs do not select a consumer React runtime; consumer resolution
follows the configuration and base dependency contracts.

The native CLI carries the version of its `@mokly/mokly` package.
It supplies that same version to sidecar hello and graph configuration keys.
Cargo crate versions do not determine the published Mokly package version.

## Viewer Files

The shim resolves `@mokly/viewer/browser` from its own package installation
and passes the directory of that entry to the binary as `MOKLY_VIEWER_DIST`.
The binary serves exactly that directory's browser inventory, shell
stylesheet, brand icon, and font. The consumer's working-directory layout does
not select the viewer.

## Signals

On POSIX hosts, the shim forwards `SIGINT`, `SIGTERM`, and `SIGHUP` to the
binary. On Windows, the binary receives the shared console signals directly,
and the shim keeps its `SIGINT` and `SIGBREAK` listeners until the binary
exits.

## Related Docs

- [Mokly package and authoring contract](./mokly-package.md)
- [Render sidecar](./mokly-sidecar.md)
- [Rust core architecture](../architecture/rust-core.md)
