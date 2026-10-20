# Verification scripts

The Cargo task runner calls these scripts for repository, viewer, browser, and
dependency verification. The [development guide](../../docs/development/README.md)
describes the complete gate and focused commands.

## Rust advisory audit

Run `npm run dependencies:check:rust`. It needs Node and Cargo but no installed
npm dependency. `audit-rust.mjs` starts `rust-audit.mjs` at the repository root.

The wrapper checks the UTC review deadline before starting a process. It reads
the locked dependency graph through Cargo metadata and checks `lightningcss`.
It installs pinned cargo-audit with its locked dependencies and runs a live JSON
audit. The report gives the effective ignore list, including configuration
changes outside the repository file. Only the approved advisory can be ignored.
Native tools parse their own TOML inputs. Every command failure propagates.

The [dependency security contract](../../docs/protocol/dependency-security.md#rust-advisory-audit)
defines the approved exception and review conditions. `tests/rust_audit.test.ts`
injects time and command results to cover expiry, version changes, extra IDs,
invalid output, and failure propagation without a network or elapsed-time assertion.
