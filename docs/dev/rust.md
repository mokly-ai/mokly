# Rust

The complete Rust conventions, with examples. [`AGENTS.md`](../../AGENTS.md)
repeats the rules that apply to every Rust edit; this document is the full
contract and takes precedence when the two differ in detail.

- Use a workspace with multiple crates to split up the code into concrete units
- Run `cargo fmt --all -- --check` after Rust changes; if it fails, run `cargo fmt --all` and re-run the check before clippy/tests are considered complete
- Run cargo clippy after making any changes
- When adding **external** dependencies (from [crates.io](https://crates.io)), use `cargo add` without a version so the newest version is used instead of guessing a version in Cargo.toml. For **workspace internal crates**, add them manually with `dependency = { workspace = true }`.
- Treat traits/interfaces as the default for all non-pure behavior, even when there is only a single implementation and that implementation lives in the same crate.
- The only routine exception is small pure free functions or small pure inherent methods on data/value structs.
  - If code has dependencies, uses injected collaborators, reaches ambient state, performs side effects, or owns hidden mutable runtime state, model it behind a trait.
  - Exported library entrypoints like `run`, `serve`, `start`, `sync`, `execute`, or similar runtime operations count as non-pure behavior and should be trait methods, not impure free functions.
- Managers/services and any impure collaborators should depend on trait objects, not concrete implementations.
  - If a struct has runtime dependencies, it should itself usually implement a trait and be consumed through `dyn Trait`, not be passed around as a concrete impure type.
  - Prefer `Arc<dyn Trait + Send + Sync>` for shared runtime dependencies.
  - Use `Box<dyn Trait>` only when ownership is truly single-owner and shared access is not needed.
  - When another crate depends on that behavior, it should depend on the `dyn Trait`; the binary/composition root should construct and inject the concrete implementation.
  - Avoid constructing concrete side-effecting dependencies directly inside manager/service structs.
  - Injecting trait-typed dependencies into a concrete manager/runner/service is not sufficient by itself; if the manager/runner/service has side effects, runtime orchestration, or hidden mutable state, that manager/runner/service must also be behind a trait when used outside the composition root.
  - Factory traits for impure behavior should return `Arc<dyn Trait + Send + Sync>` or `Box<dyn Trait>` as appropriate, not concrete runtime/service/runner structs.
- Concrete structs are still fine for pure/basic data/value types and tiny pure helpers with no runtime dependencies.
  - Small pure inherent methods on those types are fine when they improve clarity.
  - Stateful orchestrators, runners, managers, caches, schedulers, and runtime coordinators are not pure helpers and should themselves be trait-backed.
- If there is only a single implementation and the interface is local to one crate, the trait should usually live in that crate rather than forcing a separate interface crate.
- If multiple implementations are expected or the interface is shared across crates, extract the trait into a dedicated `-interface` crate and keep implementations in separate crates.
- Use diesel for database interactions (where target database is supported by it)
  - database migrations and schema should be in its own crate
  - structs for DB should not be exposed in the library but mapped to a interface struct if needed
- Prefer using `clap` library for CLI parsing
- Use `unimock` as the required mocking library for Rust unit tests at trait boundaries, including same-crate traits with a single concrete implementation.
  - Unit tests should mock trait implementations instead of using real disk IO, databases, Docker, subprocesses, clocks, network calls, or other impure dependencies.
  - Integration tests can still use real implementations when validating end-to-end behavior.
- Use `tracing` for Rust diagnostics in libraries, servers, workers, and other
  non-interactive runtime binaries. Do not use `print!`, `println!`,
  `eprint!`, `eprintln!`, or `dbg!` for logging or diagnostics in those paths.
- Direct Rust terminal output is allowed only when it is the intended
  user-facing interface: CLI command results, prompts, raw command/data output,
  interactive REPL messages, build-script `cargo:` directives, tests, examples,
  and `xtask` developer command output.
- Every crate should have its own README.md
- Inline comments should be avoided
- Rust modules must have module-level doc comments.
- Rust public API items must have doc comments, including public functions, structs, enums, traits, type aliases, constants, statics, enum variants, and public struct fields.
- Add doc comments to private Rust items when they define non-obvious behavior, invariants, or contracts that a maintainer would otherwise need to infer from the implementation.

## Rust File Size Limits

The repository gate also limits changed TypeScript/JavaScript anywhere in the repository to 300 lines and protocol Markdown to 250 lines, except pages with exact reviewed caps in `xtask/protocol-document-caps.json`; fetch `origin/main` before `cargo xtask source-file-length-lint`. It excludes only Git-ignored untracked files.

The file length linter enforces a **300-line** hard cap for Rust files under `crates/` and `xtask/` when they are changed relative to `origin/main` or present in the working tree. Run `cargo xtask rust-file-length-lint --all` to audit every Rust file under those directories. Files exceeding 300 lines must be refactored into multiple modules; there is no override mechanism.

## File Size Management

Keep files at reasonable sizes for maintainability:

- **Target**: 200 lines per file
- **Hard Limit**: 300 lines (enforced by linter, refactor immediately)
- **Do not** work around limits by removing blank lines or compacting code
- **Do not** use `include!` instead of Rust's module system. If code can't be cleanly split into modules, leave it in one big file. The only case where you should even consider `include!` is when the included code isn't meant to be read, like code generated in a build step.
- **Allow exceptions** for:
  - Complex state machines or protocol implementations
  - Generated code or large data structures
  - Files where splitting would harm cohesion
- When files grow large, consider refactoring into logical modules
- Example split for a large `tools.rs` file:
  - `tools/mod.rs`: module declarations and intentionally exported types only
  - `tools/error.rs`: error definitions
  - `tools/types.rs`: shared structs, enums, and type aliases
  - `tools/<name>.rs`: implementation modules for a coherent responsibility, named after the function, struct, or feature they implement

## Imports

- Organize imports in this order: standard library (`std`, `core`, `alloc`), external crates, current crate modules (`crate::`), then relative modules (`self::`, `super::`)
- Declare all imports at the top of the file; never place `use` statements inside functions, methods, or nested code blocks
- Before adding imports, check whether the item is already imported and extend existing groups instead of duplicating imports
- Do not rename modules or crates with `as` in import statements; use the real module path directly
- Prefer imports over inline `crate::...` paths in code, type aliases, and `dyn` trait objects; keep `crate::` paths in `use` declarations instead
- Treat ast-grep import rules such as `no-inline-use` and `prefer-imports-over-crate-paths` as required style checks, not optional cleanups

## Testing

- All test implementations must live outside production source files. Do not
  define `#[test]`, `#[tokio::test]`, or similar test bodies inline with
  non-test code; the only allowed same-file test code is the external test
  module declaration.
- For Rust tests that live under `src`, test-only directories must be named
  `_tests_` so they sort first and stand out in listings.
- Rust unit tests and other source-adjacent Rust tests under `src` should live
  in a `_tests_` subdirectory beside the owning source file and be declared
  with an explicit path module, for example
  `src/exa_web_search.rs` uses
  `#[cfg(test)] #[path = "_tests_/exa_web_search_tests.rs"] mod exa_web_search_tests;`
  with the test file at `src/_tests_/exa_web_search_tests.rs`; nested modules
  follow the same relative pattern such as `src/chat/app.rs` using
  `src/chat/_tests_/app_tests.rs`.
- When splitting a Rust test file into submodules, keep the directory name free
  of the `_tests` suffix and keep `_tests.rs` on the leaf test files. For
  example, split `src/tools/_tests_/environments_tests.rs` into
  `src/tools/_tests_/environments/mod.rs`,
  `src/tools/_tests_/environments/spawn_tests.rs`, and sibling `*_tests.rs`
  files. Apply the same rule to crate-root integration tests under `tests/`.
- When using `insta` for Rust snapshots, always use file-based snapshots stored
  under a `snapshots/` directory. Do not use inline snapshots.
- Cargo integration tests may continue to live in crate-root `tests/`
  directories.

## Visibility and Modules

- Default to the narrowest visibility that works: private items/modules first, then `pub(super)` or `pub(crate)`, and only use `pub` for intentional external API.
- Only declare `pub mod` when the module is intentionally part of the crate's external API.
- Use normal Rust module resolution for non-test modules; do not use `#[path = "..."]` outside test-only module declarations.
- Add `#![warn(unreachable_pub)]` to internal crates so over-exposed items are surfaced during linting.
- For intentional dead code, use `#[expect(dead_code, reason = "...")]`; do not add silent `#[allow(dead_code)]` without a documented reason.
- Do not create a child module directory unless it has more than one sibling
  module at the same level. Submodules are fine when they organize a real module
  family, but a single nested module in a crate is pointless.
- Keep `lib.rs`, `mod.rs`, and `bin.rs` as thin module root files. They may
  contain doc comments, module declarations, imports, and intentional type
  exports, but they should not contain runtime logic, business logic, function
  bodies, impl blocks, or other concrete code. Move real implementation into
  named sibling modules.
- When splitting `foo.rs` into a module directory, move the root module to
  `foo/mod.rs`. Do not keep `foo.rs` alongside `foo/*.rs`; apply the same rule
  to test module trees such as `tests/foo/mod.rs` and
  `src/**/_tests_/foo/mod.rs`.
- Remove empty directories after moving or deleting files. Do not leave stale
  module directories behind as placeholders; if the directory has no files, it
  should not exist.
- Do not use public re-exports to avoid updating source imports or call sites.
  Define items at their real owner module path and update downstream imports to
  use that path directly.
- Do not create pure pass-through modules whose public API is only `pub use`
  from another crate or module. Delete the wrapper and import the real owner
  directly instead.

## Explicit drops

Do not use the `drop` function unless absolutely necessary. Usually, if the code compiles without it, it is better to just leave it out.

Some resources, like mutexes should be dropped as soon as possible. This can be accomplished using scopes.

### Bad (using drop)

```rust
let resource = mutex.lock();
let result = resource.use();
drop(resource);
```

### Good (using a scope)

```rust
let result = {
    let resource = mutex.lock();
    resource.use()
};
```

## Generics

Prefer `dyn T` runtime dynamic dispatch generics over parametric / static-dispatch / monomorphization generics.

- This is an architectural rule, not just a preference for generic syntax. The goal is testable seams and swappable implementations at side-effect boundaries.

## Typing

- Prefer enums and structs over raw strings when the set of states or variants is known.
- Always fully type new domain, service, and interface code. Avoid introducing `serde_json::Value` or other untyped JSON blobs where a structured Rust type can model the contract.
- If a boundary is forced to accept or emit JSON (external API, persistence, protobuf/HTTP passthrough, etc.), convert it into a structured type as close to that boundary as possible and keep the rest of the code typed.

## Panic and Expect Guidelines

- **NEVER** use `panic!()`, `unwrap()` `expect()` in production code (test code these are fine) - always use proper error handling with Results and defined error types

## Unsafe Code Guidelines

- **AVOID** `unsafe` code blocks unless absolutely necessary for FFI (Foreign Function Interface) operations
- All `unsafe` usage MUST be accompanied by detailed safety comments explaining why it's safe
- Never use `unsafe` for performance optimizations - prefer safe alternatives
- `unsafe` blocks should be as minimal as possible and isolated to dedicated functions
- All `unsafe` code requires additional code review and documentation

## Error Handling Standards

- IMPORTANT: ALWAYS use defined enum errors with the `thiserror` macro
- Public error enums should normally be `typed handled variants + Internal(InternalError)` when the boundary needs internal fallback
- Only errors that callers explicitly branch on should stay typed; storage, provider, serialization, and other unhandled failures should collapse into `Internal(InternalError)`
- For reusable public library crates, downstream consumers count as callers, so the stable typed surface may be broader when those variants are part of the documented public API contract
- Trait/interface crates should own the error contract for their trait methods; implementation crates should return those interface errors directly instead of maintaining mirror wrapper enums
- Error-contract modules with internal fallback should normally derive `internal_error::ErrorContract`, keep the explicit `Internal(#[from] InternalError)` variant, and use the generated `#[track_caller]` helpers to capture call sites; feature code should not pass `Location::caller()` directly
- Handwritten module-local `DEFINED_AT` traits or result adapters are a fallback only when the shared derive cannot be used cleanly
- Prefix the string in thiserror's `#[error]` attribute with crate and mod name e.g. `#[error("[crate/mod] <msg>")]`
- Each crate / mod should should define its own error/result - e.g `notes::{Error, Result}`
- Always define enum variants specifically, never use strings to differentiate them
  - Good: `return Err(Error::DiffNoFilePatches);`
  - Bad: `return Err(Error::Parse { reason: "diff no file patches" });`
- For the canonical internal fallback path, prefer `Internal(#[from] InternalError)` over a manual `impl From<InternalError>` so `?` can promote internal failures without boilerplate
- Use `res?;` or `Ok(res?)`, rather than `.into()` or `.map_err(Error::Variant)`
- Never use `#[error(transparent)]`
- For base/originating errors, use enum varient fields to provide additional data and include that in `#[error]` message

- Counterexamples to avoid:
  - NEVER use `eyre` or `anyhow` dependencies
  - Reserve thiserror `#[from]` for the canonical `Internal(#[from] InternalError)` path; do not use it for public wrapper variants or cross-crate error translation
  - Never match errors using `.contains()` on error strings
  - Never use generic catch-all: `Other(String)`
  - Never use `format!`/`to_string()` in call sites for errors.
  - Never stringify internal failures into ad hoc message variants such as `Json { message: String }`, `Store { message: String }`, or similar string-based error buckets. Preserve the source error type in `InternalError` or in a specific typed enum variant.
  - Never use `map_err(...)` directly in production Rust code for error conversion or context. It hides the real caller location from `#[track_caller]`-based helpers. Use `?`, typed branching, or a `#[track_caller]` result/error helper method instead. The only routine exception is inside the shared helper implementation that preserves caller capture.
  - Avoid using `.into()` for errors or `.map_err(Error::Variant)`, use `res?;` or `Ok(res?)` instead
