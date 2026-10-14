# @mokly/native-linux-x64-gnu

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This package carries the Mokly binary for `linux-x64-gnu`. Install
`@mokly/mokly` to use the CLI. Its shim selects this package and requires the
exact same version.

The binary under `bin/` is build output. It is not committed. From the
workspace root, `cargo xtask build-native` builds and installs the host binary.
The release matrix supplies the binary for each other target.

See the [release contract](../../docs/protocol/npm-release.md).
