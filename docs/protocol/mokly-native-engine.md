# Native Engine

## Delivery Status

The [native engine plan](../../plans/native-rust-engine.md) is the approved
target for this contract; no part of it is implemented yet. Until the plan
delivers the engine, the exclusive export rename and the Windows baseline job
use the lazily loaded Koffi bridge with the primitives named below, and the
comparison engine runs in TypeScript inside the Node process. Contracts that
name this document for an engine-backed rule keep their current behavior until
this Delivery Status records delivery.

## Boundary

The engine is a Rust library that the CLI loads into its own Node process
through Node-API bindings built with napi-rs. It owns work that needs no React
and no consumer JavaScript. It never evaluates consumer code, never resolves
consumer modules, never renders, and never runs PostCSS plugins. React,
esbuild, the consumer renderer, the viewer, and the HTTP server stay in
JavaScript.

- One call performs one coarse operation: one rename, one job action, one
  resource closure, one stylesheet analysis, one classification. No per-file
  callback crosses the boundary.
- Only UTF-8 strings, JSON-serializable objects, and byte buffers cross.
  Buffers are transferred without copying where Node-API allows it. Functions,
  React nodes, and consumer modules never cross.
- Byte and count bounds stay as the owning contracts define them, for example
  the 64 MiB resource closure and the Git output bounds.
- The engine writes nothing to standard output or error. Its `tracing` output
  reaches the caller only through the diagnostic event below.

## Packages And Platforms

| npm package                     | Rust target                 | `os`     | `cpu`   | `libc`  |
| ------------------------------- | --------------------------- | -------- | ------- | ------- |
| `@mokly/engine-linux-x64-gnu`   | `x86_64-unknown-linux-gnu`  | `linux`  | `x64`   | `glibc` |
| `@mokly/engine-linux-arm64-gnu` | `aarch64-unknown-linux-gnu` | `linux`  | `arm64` | `glibc` |
| `@mokly/engine-darwin-x64`      | `x86_64-apple-darwin`       | `darwin` | `x64`   | none    |
| `@mokly/engine-darwin-arm64`    | `aarch64-apple-darwin`      | `darwin` | `arm64` | none    |
| `@mokly/engine-win32-x64-msvc`  | `x86_64-pc-windows-msvc`    | `win32`  | `x64`   | none    |

Each platform package contains one binary, `mokly-engine.<target>.node`, plus
`package.json`, `README.md`, and `LICENSE`. Its `main` is the binary, its
`os`, `cpu`, and Linux `libc` fields match the table, its `engines` equals the
CLI's Node range, its license is MIT, and its version equals the CLI version.
`@mokly/mokly` lists all five under `optionalDependencies` at that exact
version. In the repository the platform packages are npm workspaces at
`crates/mokly-engine/npm/<target>/`; Release Please bumps their versions and
the CLI's `optionalDependencies` entries together with the CLI version. A
platform outside the table has no package.

Crates: `crates/mokly-engine` holds the `cdylib` binding and no logic;
`crates/mokly-platform` holds the rename and job primitives;
`crates/mokly-review-model` holds the manifest v8, review result v5, artifact,
and catalogue change snapshot v2 types with canonical JSON output;
`crates/mokly-git` runs Git; `crates/mokly-review` holds comparison. The
binding's declarations are generated into `src/engine/bindings.d.ts` and
committed; a test regenerates them and requires identical bytes.

## Loading

`src/engine/load.ts` owns loading. The first engine-backed operation loads
the binding; `--help`, `--version`, `build`, and `check` never load it, and
Serve loads it at its first engine-backed operation, such as a derived
baseline rebuild on Windows or its first classification. The platform key is
`<process.platform>-<process.arch>`, followed by `-gnu` on Linux when
`process.report.getReport().header.glibcVersionRuntime` is present and `-musl`
otherwise, and by `-msvc` on Windows. The loader resolves
`@mokly/engine-<key>` with a `createRequire` rooted at the CLI package, so it
finds the optional dependency installed beside the CLI and the workspace link
inside the repository. It then calls `engineVersion()` and requires the exact
CLI `package.json` version.

A missing package, a failed load, or a version mismatch fails the operation.
The loader never substitutes a JavaScript implementation for an engine-backed
operation. Its sentence is appended to the owning command's first sentence and
presented under the owner's existing error code:

```text
Mokly's native engine is not installed for <platform>/<arch>[/<libc>]. Reinstall @mokly/mokly with optional dependencies enabled on a supported platform.
Mokly's native engine version <engine> does not match @mokly/mokly <cli>. Reinstall @mokly/mokly so both versions match.
```

While comparison moves into the engine, the private `MOKLY_NATIVE_ENGINE=0`
environment variable selects the TypeScript comparison implementation for
differential runs. It never affects rename or job operations, it is not a CLI
option, and it is removed when the engine owns every comparison phase.

## Operations

| Operation                                   | Mode  | Input                                                                                                                                                                   | Output                                                                                                |
| ------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `engineVersion()`                           | sync  | none                                                                                                                                                                    | the engine's semantic version                                                                         |
| `renameExclusive(from, to)`                 | sync  | two absolute NUL-free paths                                                                                                                                             | nothing; the destination is never replaced                                                            |
| `createProcessJob()`                        | sync  | none                                                                                                                                                                    | a `ProcessJob` with `assign(pid)`, `terminate()`, and `dispose()`; the last returns a promise         |
| `resourceClosure(request, options)`         | async | side, route, the document bytes, a reader descriptor, public exclusions, and the embedded-document flag                                                                 | the transitive resource closure, embedded documents, and unresolved references under the 64 MiB bound |
| `analyzeStylesheetChange(request, options)` | async | before and after stylesheet text and the normalized before and after documents                                                                                          | one `CssAnalysisOutcome` as the [CSS attribution contract](./mokly-css-attribution.md) defines        |
| `compareCatalogue(request, options)`        | async | the current manifest and outputs, the baseline reader descriptor, the comparison configuration, generation routes and delivered sources, and accepted document Markdown | the review artifact: result v5, pairing, snapshots, and resource bytes as buffers                     |
| `classifyChanges(request, options)`         | async | the comparison configuration, base, pinned commit, accepted generation, manifest, and outputs                                                                           | the catalogue change snapshot for Serve, or the export artifact                                       |

A reader descriptor names one source of bytes: an in-memory route map, an
output directory with its mockups path, a Git commit under a repository root,
or a completed derived baseline tree. Public files add the repository root and
the configured public exclusions. Record shapes are the ones the
[Changes](./mokly-changes.md), [component review](./mokly-component-review.md),
and [serving](./mokly-changes-serving.md) contracts already define; the
committed declarations are the typed source of truth.

`options` carries an `AbortSignal` and an event callback. Synchronous
operations run on the calling thread and return in bounded time.
Asynchronous operations run on one Node-API async task each and never block
the event loop. The engine runs at most one classification per process; the
caller serializes requests as the background worker does today. Comparison
data lives in engine memory outside the JavaScript heap, so a worker heap cap
no longer bounds comparison; the [diagnostic contract](./mokly-timings.md)
records the scale fixture's memory budget.

## Events And Cancellation

The event callback receives one of three records:

```ts
{ kind: "timing", stage, event: "start" | "end" | "counts", id, parentId?, elapsedMs, durationMs?, status?, cacheHit?, counts? }
{ kind: "progress", stage, completed, total }
{ kind: "diagnostic", message }
```

Timing records use the caller's session and role. The caller passes its
current span id and the next free id; the engine numbers its spans from that
id and nests them under the caller's span. Stage names stay the ones the
diagnostic contract defines, so `review.*` spans keep their names, nesting,
and counts whether TypeScript or the engine produces them. `engine.load`
measures loading and version validation once per process. The engine emits no
timing record while timings are disabled. A diagnostic message is bounded to
64 KiB, like today's child diagnostics.

On abort, an asynchronous operation stops at its next checkpoint, terminates
any Git child process it spawned, and rejects with the `aborted` code; the
caller presents it as the existing cancellation.

## Errors

Every engine error carries one stable `code`, a message, and typed detail. The
owning command presents it under its existing `MoklyError` code; messages never
name napi, crates, or Rust types.

| Engine code          | Meaning                                                         | Owner presentation             |
| -------------------- | --------------------------------------------------------------- | ------------------------------ |
| `engine-unavailable` | No platform package, a failed load, or a version mismatch       | the loader sentences above     |
| `invalid-argument`   | Validation failed before any OS or engine work                  | the owner's invalid-input rule |
| `rename-failed`      | The OS refused the rename; `os` carries the errno name or code  | `export-invalid`               |
| `job-unsupported`    | A job object was requested outside Windows                      | baseline command failure       |
| `job-failed`         | A Win32 job call failed; detail names the call and code         | baseline command failure       |
| `git-failed`         | Git exited non-zero or was signalled; detail carries stderr     | `git-failed`                   |
| `read-failed`        | A confined read failed; detail carries the path and reason      | `review-invalid`               |
| `bound-exceeded`     | A documented byte or count bound was reached                    | `review-invalid`               |
| `aborted`            | The signal was triggered                                        | existing cancellation          |
| `internal`           | An unexpected engine failure; never a panic across the boundary | the owner's code, with detail  |

## Build, Verification, And Release

- `cargo xtask build-engine [--target <triple>]` compiles the binding in the
  release profile and installs the binary into its workspace platform package.
  `npm run build` runs it for the host. It compiles from source and never
  downloads a prebuilt binary.
- The repository suite keeps Rust formatting, Clippy with warnings denied,
  tests, and the file-length audit for `crates/`, and adds a Rust advisory
  audit against the RustSec database after the npm audit. Its exceptions live
  in `scripts/verification/rust-audit-exceptions.json` with `advisory`
  (a RUSTSEC identifier), `crate`, `until`, `reason`, and `tracking`, under
  the same inclusive UTC expiry, 31-day window, stale-record, and
  duplicate rules as the npm exceptions.
- Every CI verification job builds the host engine before its suite. A pinned
  cache action keys the Cargo registry and build directory from `Cargo.lock`
  and the toolchain version; `npm ci` and the engine build always run.
- The native platform jobs build the engine on macOS and Windows and run the
  Rust crate tests with the existing native TypeScript tests.
- The release workflow builds all five targets on GitHub-hosted runners,
  loads each binary on a runner of its platform and checks `engineVersion()`,
  then hands the binaries to the publish job as artifacts. The publish job
  packs and inspects every platform package, publishes them first, then the
  viewer, then the CLI, and guards and verifies each registry package. A
  missing or mismatched binary fails before any publication.
- Packed-consumer smokes install the host platform package tarball with the
  viewer and CLI archives, so an unpublished package is never resolved from
  the registry.

## Security

No consumer code runs in the engine. Reads are confined to the repository
root, the baseline cache, the review output, and the export destination, as
each owning contract requires, and symlink escapes are rejected the same way.
The Git child process receives the same argv and environment rules as the
TypeScript Git runner. `unsafe` code is limited to the FFI calls of the
platform crate.

## Related Docs

- [Package and authoring contract](./mokly-package.md)
- [Export recovery](./mokly-export-recovery.md)
- [Baseline storage and execution](./mokly-baseline-storage.md)
- [Startup diagnostics and scale fixtures](./mokly-timings.md)
- [CI and npm release](./npm-release.md)
- [Dependency security](./dependency-security.md)
