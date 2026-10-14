# @mokly/mokly

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

`@mokly/mokly` supplies the `mokly` Node shim. It selects the host's native
binary, checks that its version equals this package version, and starts it
with inherited standard streams. It has no JavaScript CLI fallback.

The supported Node range is `>=22.14.0 <24.14.0 || >=24.19.0`. The shim checks
it before package lookup. Supported hosts are Linux x64 and arm64 with glibc,
macOS x64 and arm64, and Windows x64 with MSVC.

```bash
npm install --save-dev @mokly/mokly
npx --no-install mokly --help
npx --no-install mokly --version
```

The native binary owns commands and file writes. The render sidecar and the
authoring API share this package under the
[package contract](../../docs/protocol/mokly-package.md).

From the workspace root:

```bash
npm run build
node --test tests/mokly_shim.test.mjs
node packages/mokly/bin/mokly.mjs --help
```

The build copies the shim's ESM sources into `dist`. Native binaries are
ignored build output under the host platform package. The exact optional
platform dependencies must stay enabled in consumer installs. React and
React DOM are optional peers for React authoring.
