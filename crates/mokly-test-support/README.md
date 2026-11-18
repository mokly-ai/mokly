# mokly-test-support

`mokly-test-support` gives the Rust tests of the workspace one shared way to
capture `tracing` spans and events. Depend on it as a dev-dependency when a
test checks a span, an event, or their fields. The crate is internal. Its
manifest sets `publish = false`, and no production code depends on it. It
depends only on `tracing` and `tracing-subscriber`.

The tests of `mokly-cli`, `mokly-render`, `mokly-compare`, `mokly-sidecar`,
`mokly-graph`, and `mokly-server` use it. Production subscribers, such as the
Serve timing layer of `mokly-cli`, stay in their own crates.

## Responsibilities

- Install one disabled global interest guard in each test process.
- Capture the spans and events of one scope into owned records.
- Keep each capture apart from the captures of parallel tests.
- Give a test the dispatcher of its capture for the threads that it owns.
- Install the guard before a scoped subscriber that a test builds itself.

## What This Crate Does

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

Run the regression test of the guard:

```bash
cargo test -p mokly-sidecar --lib trace_capture
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
It asserts no elapsed time.

Follow these rules when you add a capture:

- Install a test subscriber only through `Trace` or `subscriber::with_default`.
  Both install the guard first.
- Do not install a global subscriber in a test binary that uses this crate.
- Install `Trace::dispatcher` on each thread that the test starts. Use
  `tracing::dispatcher::with_default` for one closure, or
  `tracing::dispatcher::set_default` in the thread-start hook of a test
  runtime.

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
- [`../mokly-sidecar/src/_tests_/trace_capture_tests.rs`](../mokly-sidecar/src/_tests_/trace_capture_tests.rs)
  holds the first-registration regression test of the guard.
- [`../mokly-server/src/_tests_/changes_trace_support.rs`](../mokly-server/src/_tests_/changes_trace_support.rs)
  sets a capture's dispatcher as the default of each thread of a test runtime.

### Related Docs

- [Rust core architecture](../../docs/architecture/rust-core.md).
- [CI test timing](../../docs/protocol/ci-test-timing.md).
