# mokly-test-support

`mokly-test-support` gives the Rust tests of the workspace three shared tools.
It captures `tracing` spans and events, it creates private fixture folders for
tests that need a durable capture, and on Unix it records whether a root
process was reaped at each signal of its tree guard. Depend on it as a dev-dependency. The crate
is internal. Its manifest sets `publish = false`, and no production code
depends on it. It depends on `tracing`, `tracing-subscriber`, `tempfile`, `mokly-platform`,
and, on Unix, `libc`.

The tests of `mokly-cli`, `mokly-render`, `mokly-compare`, `mokly-sidecar`,
`mokly-graph`, and `mokly-server` use the trace capture. Six tests of
`mokly-compare` and `mokly-render` use the durable fixture. Production
subscribers, such as the Serve timing layer of `mokly-cli`, stay in their own
crates.

## Responsibilities

- Install one disabled global interest guard in each test process.
- Capture the spans and events of one scope into owned records.
- Keep each capture apart from the captures of parallel tests.
- Give a test the dispatcher of its capture for the threads that it owns.
- Install the guard before a scoped subscriber that a test builds itself.
- Give each test that needs a durable capture its own owner folder. Then no
  other fixture changes the folders above its inputs during a capture.

## What This Crate Does

### Trace capture

A callsite is one span or event macro in the code. `tracing-core` caches the
interest of each callsite: whether it is enabled. While one scoped subscriber
is the only dispatcher in the process, the first thread that registers a
callsite sets that cache. A parallel test thread without a capture then caches
`never`, and the callsite disappears from every capture. The interest guard
prevents this: a global dispatcher that enables nothing and returns
`Interest::sometimes()` for each callsite. Each span and event then asks the
dispatcher of its own thread.

The tests own the global dispatcher. The first `Trace` or
`subscriber::with_default` call in a test process installs the guard with
`tracing::subscriber::set_global_default`, once. When another global
subscriber exists first, the install panics with the message
`Rust test captures own the global tracing dispatcher`. The guard records
nothing.

Captures stay local to their scope. `Trace` builds one `tracing::Dispatch`
from a `tracing-subscriber` Registry and a private capture layer.
`Trace::in_scope` makes that dispatcher the default of the current thread for
one closure. Clones of a `Trace` share its records and its dispatcher. Each test
creates its own `Trace`, so the records of parallel tests do not mix.

`Trace::spans` returns every span in creation order, also the spans that are
still open. `Trace::closed` returns the spans with one name in close order,
with the fields that each span has when its last reference drops.
`Trace::events` returns every event in observation order. The module `records`
defines the two record types:

- `CapturedSpan` holds a capture-local `id` that starts at 1, the `name`, the
  `parent` id, the `parent_name`, and the latest `fields`. A string field keeps
  its value as it is. Each other field uses its debug format.
- `CapturedEvent` holds the `level`, the `fields` in visitor order, and the
  `scope`. The scope gives the names of the enclosing spans, from the root to
  the parent. Each event field uses its debug format, so a string value keeps
  its quotes.

`Trace::with_observer` takes an `Arc<dyn EventObserver>`. The capture calls
`EventObserver::event` for each event before the emitting call returns. A test
can then log an event at its exact place in the order of the code under test.

The caller carries the dispatcher to other threads. A capture sees only the
work of threads that use its dispatcher as their default. `Span::in_scope` and
`Instrument` carry a span to another thread, but not its dispatcher. On a
thread without the dispatcher, a new span or event goes to the default of that
thread. That default is usually the guard, so the capture does not see the span
or event. Production code that carries the dispatcher itself, as the render
pool of `mokly-graph` does, needs no extra step.

`subscriber::with_default` runs a closure under a subscriber that the test
builds itself, such as the Registry and timing layer of `mokly-cli`. It
installs the guard and then calls `tracing::subscriber::with_default` with the
subscriber unchanged. So `Dispatch::downcast_ref` still finds the subscriber
and its layers. The helper keeps no reference to the dispatcher after the scope.

### Durable fixtures

A full capture of the sidecar records a witness for each folder on the path to
each recorded input, up to the file system root. When a witness is too new or
changes during the compile, the evidence is not durable. Then the bundle cache
stores nothing, and the core of a Serve head keeps no plan record. The
[Stable Capture](../../docs/protocol/mokly-base-cache.md#stable-capture) rule
allows this refusal. Some tests assert a disk hit, an unchanged build with no
compile, or a saved plan. Such a test needs fixture ancestors that no other
fixture changes during its captures.

`durable_fixture::create(owner)` returns an `io::Result<TempDir>`. First it
creates `target/durable-capture-fixtures/rust` and
`target/durable-capture-fixtures/node` in the checkout. Then it creates the
folder of every Rust owner under `rust`. Last, it creates the scoped `TempDir`
in the folder of the given owner. `Owner` is a closed list of eight variants:

| Owner                      | Folder                       | Test                                                    |
| -------------------------- | ---------------------------- | ------------------------------------------------------- |
| `CompareWarmPlan`          | `compare-warm-plan`          | The warm edit plan test of `bundle_pool_tests`          |
| `CompareRecipeReplacement` | `compare-recipe-replacement` | The recipe replacement test of `bundle_pool_tests`      |
| `CompareAbsolutePaths`     | `compare-absolute-paths`     | The absolute paths test of `bundle_pool_tests`          |
| `CompareConfigDir`         | `compare-config-dir`         | The test of `config_dir_pool_tests`                     |
| `RenderPlanChanges`        | `render-plan-changes`        | The nine-case Serve plan test of `mokly-render`         |
| `RenderAbsolutePaths`      | `render-absolute-paths`      | The absolute paths Serve plan test                      |
| `RenderPlanCandidates`     | `render-plan-candidates`     | The serialized editor-file plan tests of `mokly-render` |
| `ServePostcssRestart`      | `serve-postcss-restart`      | The warm PostCSS restart test of `serve_js_tests`       |

`durableRoot(context, owner)` in `tests/helpers/durable_fixture.ts` applies
the same rule to two Node CLI tests, with the owners `static-config-dir` and
`static-absolute-paths`. It creates the same two runtime folders and both Node
owner folders. Then it returns a scoped child of the owner folder.

The fixtures follow these rules:

- Each concurrent test uses its own owner. Only that test creates or removes
  entries in its owner folder. The sequential cases of one test share its
  owner.
- Each helper creates both runtime folders and every owner folder of its
  runtime before it returns a fixture. So a later fixture does not change a
  folder above the capture of another test.
- A Rust child goes when its `TempDir` drops. A Node child goes when its test
  ends. The fixture root, the two runtime folders, and the ten owner folders
  stay, empty.
- The anchor is the `target` folder of the checkout, also when
  `CARGO_TARGET_DIR` names another folder. The helpers make no folder for each
  process and keep no pool of free slots.

The fixtures have these limits:

- They isolate only the changes that fixtures make. Another writer can still
  make a capture not durable. It can write in `target` or in a folder above
  it, such as the checkout folder, the home folder, or `/`.
- A checkout inside a `.context` folder keeps that `.context` folder and its
  task folder above `target`. Many agent worktrees use such paths. The
  fixtures cannot isolate those folders, and the product has no hook for it.
- Two concurrent users of one owner share its folder, so neither is private.
- The fixtures change only where tests put their files. They change no product
  rule.

### Reap order

`reap_order::Watched` is a `ProcessGroups` that uses the system process groups.
Its guards record a `Root` state before each `terminate` and `kill`: `Unreaped`
or `Reaped`. The check uses `waitid` with `WNOHANG` and `WNOWAIT`, so it never
reaps the root itself. The Git runner, base install, and sidecar tests use it
to show that no tree signal follows the reap of the root, as the
[runtime shutdown rules](../../docs/protocol/mokly-runtime.md#shutdown) require.

## Quick Start

Add the crate to the dev-dependencies of the crate under test:

```toml
[dev-dependencies]
mokly-test-support = { workspace = true }
```

Capture a span in one scope, and an event on a worker thread:

```rust
use mokly_test_support::capture::Trace;

#[test]
fn the_span_keeps_its_final_status() {
    let trace = Trace::default();
    trace.in_scope(|| {
        let span = tracing::info_span!("work", status = tracing::field::Empty);
        span.record("status", "ok");
    });
    let closed = trace.closed("work");
    assert_eq!(closed.len(), 1);
    assert_eq!(closed[0].fields["status"], "ok");
}

#[test]
fn a_worker_event_reaches_the_capture_through_its_dispatcher() {
    let trace = Trace::default();
    let dispatcher = trace.dispatcher();
    std::thread::spawn(move || {
        tracing::dispatcher::with_default(&dispatcher, || tracing::warn!(attempt = 2));
    })
    .join()
    .unwrap();
    let events = trace.events();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].level, tracing::Level::WARN);
    assert_eq!(events[0].fields, [("attempt".to_owned(), "2".to_owned())]);
}
```

Create the private fixture of one owner. The warm edit plan test of
`crates/mokly-compare/tests/bundle_pool_tests.rs` starts like this:

```rust
use mokly_test_support::durable_fixture::{self, Owner};

let temporary = durable_fixture::create(Owner::CompareWarmPlan).unwrap();
let root = dunce::canonicalize(temporary.path()).unwrap();
let source = root.join("source");
let cache = root.join("cache");
```

Run the regression test of the guard and the tests that use the fixtures:

```bash
cargo test -p mokly-sidecar --lib trace_capture
cargo test -p mokly-compare --test bundle_pool_tests
cargo test -p mokly-compare --test config_dir_pool_tests
cargo test -p mokly-render --test integration_tests plan_invalidation_tests
cargo test -p mokly-render --test integration_tests plan_candidate_tests
cargo test -p mokly-cli --test serve_js_tests postcss_restart_tests
```

## Development

```bash
cargo clippy -p mokly-test-support --all-targets -- -D warnings
```

The crate has no tests of its own. The trace tests of its consumers use it
through real production callsites. The sidecar test
`a_callsite_first_registered_without_a_capture_still_reaches_the_capture`
protects the guard. It uses channels to make a thread without a capture
register a callsite first. Then it checks that the capture still sees the span.
It asserts no elapsed time. The durable fixture tests use real Node sidecars,
real file system evidence, and real disk caches.

Follow these rules when you add a capture:

- Install a test subscriber only through `Trace` or `subscriber::with_default`.
  Both install the guard first.
- Do not install a global subscriber in a test binary that uses this crate.
- Install `Trace::dispatcher` on each thread that the test starts. Use
  `tracing::dispatcher::with_default` for one closure, or
  `tracing::dispatcher::set_default` in the thread-start hook of a test
  runtime.

Follow these rules when you add a durable fixture:

- Give each new Rust test its own `Owner` variant, folder name, and entry in
  `OWNERS`. Give each new Node test its own entry in the `owners` list of
  `tests/helpers/durable_fixture.ts`.
- Keep the fixture root and the two runtime folder names equal in both
  helpers.
- Keep every assertion of the test. The fixture changes only where the test
  puts its files.
- A fixture root is inside the checkout, so a compile there reads the package
  type of the checkout `package.json` and the checkout `tsconfig.json`. Give a
  consumer project root its own `package.json` without a type and an empty
  `tsconfig.json`, as the Serve fixture of `serve_js_tests` does. Then it
  compiles as it does in a temporary folder.

### Key Code

- [`src/capture.rs`](./src/capture.rs) defines `Trace`, which runs a closure
  under its dispatcher and returns span and event snapshots.
- [`src/records.rs`](./src/records.rs) defines `CapturedSpan`,
  `CapturedEvent`, and `EventObserver`, the public records and the synchronous
  event hook.
- [`src/subscriber.rs`](./src/subscriber.rs) provides `with_default`, which
  installs the guard and then runs a test's own subscriber for one closure.
- [`src/interest_guard.rs`](./src/interest_guard.rs) holds the private
  `InterestGuard` and installs it once in each process.
- [`src/capture_layer.rs`](./src/capture_layer.rs) and
  [`src/fields.rs`](./src/fields.rs) record capture ids, parents, fields, and
  events from Registry callbacks.
- [`src/durable_fixture.rs`](./src/durable_fixture.rs) defines `Owner` and
  `create`, which make the shared folders and every Rust owner folder before a
  scoped `TempDir`.
- [`src/reap_order.rs`](./src/reap_order.rs) defines `Watched`, the recording
  process groups, and `root`, the reap check of one child.
- [`../../tests/helpers/durable_fixture.ts`](../../tests/helpers/durable_fixture.ts)
  defines `durableRoot`, the Node helper with the same ownership rule.
- [`../mokly-compare/tests/bundle_pool_tests.rs`](../mokly-compare/tests/bundle_pool_tests.rs),
  [`../mokly-compare/tests/config_dir_pool_tests.rs`](../mokly-compare/tests/config_dir_pool_tests.rs),
  [`../mokly-render/tests/integration/plan_invalidation_tests.rs`](../mokly-render/tests/integration/plan_invalidation_tests.rs),
  [`../mokly-render/tests/integration/plan_support.rs`](../mokly-render/tests/integration/plan_support.rs),
  and
  [`../mokly-cli/tests/serve_js/postcss_restart_tests.rs`](../mokly-cli/tests/serve_js/postcss_restart_tests.rs)
  hold the eight Rust fixture owners.
- [`../mokly-sidecar/src/_tests_/trace_capture_tests.rs`](../mokly-sidecar/src/_tests_/trace_capture_tests.rs)
  holds the first-registration regression test of the guard.
- [`../mokly-server/src/_tests_/changes_trace_support.rs`](../mokly-server/src/_tests_/changes_trace_support.rs)
  sets a capture's dispatcher as the default of each thread of a test runtime.

### Related Docs

- [Rust core architecture](../../docs/architecture/rust-core.md).
- [CI test timing](../../docs/protocol/ci-test-timing.md).
- [Stable Capture](../../docs/protocol/mokly-base-cache.md#stable-capture), the
  rule that makes a capture not durable.
