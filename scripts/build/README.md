# Workspace build

`npm run build` runs [`build.mjs`](./build.mjs). It builds the host native
binary with `cargo xtask build-native` and the `@mokly/ui`, `@mokly/model`,
`@mokly/frame`, `@mokly/viewer`, and `@mokly/mokly` packages with their own
`build` scripts. The
[developer test commands](../../docs/protocol/developer-test-commands.md#public-commands-and-preparation)
hold the rules of the skip and of the build order.

## Key code

- [`build-steps.mjs`](./build-steps.mjs) lists each package step: the
  repository paths that its build reads, the paths that it writes, and the
  earlier steps whose outputs it reads. Add a path here when a package build
  starts to read it. A path that is missing from the list does not rebuild
  the package when it changes.
- [`workspace-build.mjs`](./workspace-build.mjs) holds `runWorkspaceBuild`,
  which orders the steps, skips the steps whose records match, runs the rest,
  and writes the record of each successful step.
- [`build-digest.mjs`](./build-digest.mjs) hashes the files of the repository
  paths of a step and combines the hashes into one key.

## Records

Each successful package build writes its record under
`node_modules/.cache/mokly-build/`. The record holds the key of the inputs and
the digest of the outputs. `npm ci` removes `node_modules`, so the next build
runs every package build. To run every package build without a reinstall,
remove `node_modules/.cache/mokly-build/`. Build one package alone with
`npm run build --workspace {package}`; the next `npm run build` then compares
the new outputs with its record and builds that package again when they differ.
