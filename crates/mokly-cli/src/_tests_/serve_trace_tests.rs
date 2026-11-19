//! Timing records use a mocked clock and terminal and never expose authored fields.

use std::sync::atomic::AtomicU64;
use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use mokly_cli::redaction::Redactor;
use mokly_graph::cache::{MemoryCache, RenderCache};
use mokly_sidecar::workers::ClockMock;
use mokly_test_support::subscriber::with_default;
use serde_json::Value;
use tracing::{Dispatch, Subscriber};
use tracing_subscriber::Layer;
use tracing_subscriber::layer::SubscriberExt;
use unimock::{MockFn, Unimock, matching};

use crate::terminal::TerminalMock;

use super::Timings;

pub(super) fn capture(run: impl FnOnce()) -> Vec<Value> {
    capture_cache(Arc::new(empty_cache()), run)
}

/// Capture records with a scripted render cache behind the timing layer.
pub(super) fn capture_cache(cache: Arc<dyn RenderCache>, run: impl FnOnce()) -> Vec<Value> {
    let clock = Unimock::new(ClockMock::now_ms.each_call(matching!()).returns(0u64));
    collect_lines(run, &clock, Arc::new(Redactor::default()), cache, || {})
        .iter()
        .map(|line| serde_json::from_str(line.strip_prefix("[mokly:timing] ").unwrap()).unwrap())
        .collect()
}

/// An empty cache whose statistics stay zero, for records that are not about the cache.
fn empty_cache() -> MemoryCache {
    MemoryCache::new(0, 0)
}

pub(super) fn capture_lines(run: impl FnOnce()) -> Vec<String> {
    capture_redacted(run, Redactor::default())
}

pub(super) fn capture_redacted(run: impl FnOnce(), redactor: Redactor) -> Vec<String> {
    let clock = Unimock::new(());
    collect_lines(
        run,
        &clock,
        Arc::new(redactor),
        Arc::new(empty_cache()),
        || {},
    )
}

/// The inner layer acknowledges destruction after the outer timing layer drops its clones.
struct CaptureReleased(mpsc::SyncSender<()>);

impl<S: Subscriber> Layer<S> for CaptureReleased {}

impl Drop for CaptureReleased {
    fn drop(&mut self) {
        let _ = self.0.send(());
    }
}

fn collect_lines(
    run: impl FnOnce(),
    clock: &Unimock,
    redactor: Arc<Redactor>,
    cache: Arc<dyn RenderCache>,
    after_scope: impl FnOnce(),
) -> Vec<String> {
    let records = Arc::new(Mutex::new(Vec::new()));
    let output = records.clone();
    let terminal = Unimock::new(TerminalMock::stderr.each_call(matching!(_)).answers_arc(
        Arc::new(move |_, line| {
            output.lock().unwrap().push(line.to_owned());
        }),
    ));
    let layer = Timings {
        terminal: Arc::new(terminal.clone()),
        session: "test".into(),
        clock: Arc::new(clock.clone()),
        next: AtomicU64::new(1),
        redactor,
        cache,
    };
    let (released, finished) = mpsc::sync_channel(1);
    with_default(
        tracing_subscriber::registry()
            .with(CaptureReleased(released))
            .with(layer),
        run,
    );
    after_scope();
    finished.recv().unwrap();
    records.lock().unwrap().clone()
}

#[test]
fn timing_mock_verification_waits_for_a_foreign_dispatch_release() {
    let clock = Unimock::new(());
    let (send, receive) = mpsc::sync_channel::<Dispatch>(1);
    let (release, released) = mpsc::sync_channel(1);
    let worker = thread::spawn(move || {
        let dispatch = receive.recv().unwrap();
        released.recv().unwrap();
        assert!(dispatch.downcast_ref::<Timings>().is_some());
    });
    let lines = collect_lines(
        || {
            tracing::info!(sidecar_timing = "owned timing record");
            tracing::dispatcher::get_default(|dispatch| send.send(dispatch.clone()).unwrap());
        },
        &clock,
        Arc::new(Redactor::default()),
        Arc::new(empty_cache()),
        || {
            release.send(()).unwrap();
            worker.join().unwrap();
        },
    );
    assert_eq!(lines, ["owned timing record\n"]);
}

#[test]
fn unsuccessful_review_spans_remain_error_and_emit_no_complete_counts() {
    let records = capture(|| {
        let span = tracing::info_span!("review.compare-views", status = "error");
        let _scope = span.enter();
        {
            let span = tracing::info_span!("review.base-dependencies", status = "error");
            let _scope = span.enter();
        }
        let span = tracing::info_span!("review.resource-graph", status = "error");
        let _scope = span.enter();
    });
    assert_eq!(records.len(), 7);
    for record in records.iter().filter(|record| record["event"] == "end") {
        assert_eq!(record["status"], "error");
        assert!(record.get("tier").is_none());
    }
    let counts: Vec<_> = records
        .iter()
        .filter(|record| record["event"] == "counts")
        .collect();
    assert_eq!(counts.len(), 1);
    assert_eq!(counts[0]["stage"], "render.cache");
    assert_eq!(counts[0]["restores"], 0);
    assert_eq!(counts[0]["restoreFailures"], 0);
    assert_eq!(counts[0]["phase"], "review.compare-views");
    assert!(counts[0].get("views").is_none());
}

#[test]
fn each_successful_dependency_tier_is_a_numeric_end_field() {
    let records = capture(|| {
        for tier in 1..=3u64 {
            let span = tracing::info_span!(
                "review.base-dependencies",
                status = "error",
                tier = tracing::field::Empty,
            );
            let _scope = span.enter();
            span.record("tier", tier);
            span.record("status", "ok");
        }
    });
    assert_eq!(records.len(), 6);
    for (index, pair) in records.chunks_exact(2).enumerate() {
        assert!(pair[0].get("tier").is_none());
        assert_eq!(pair[1]["status"], "ok");
        assert_eq!(pair[1]["tier"], index + 1);
    }
}

#[test]
fn preparation_detail_spans_keep_parentage_and_exclude_inputs() {
    let records = capture(|| {
        let _graph = tracing::info_span!("graph.prepare").entered();
        let _documents = tracing::info_span!("graph.prepare.documents").entered();
        {
            let _resources = tracing::info_span!(
                "graph.prepare.resources",
                path = "private.png",
                source = "private source"
            )
            .entered();
        }
        let _routing =
            tracing::info_span!("graph.prepare.routing-records", path = "private-entry").entered();
    });
    assert_eq!(records.len(), 8);
    let documents = &records[1];
    assert_eq!(documents["parentId"], records[0]["id"]);
    for record in [&records[2], &records[4]] {
        assert_eq!(record["parentId"], documents["id"]);
    }
    for record in records {
        assert!(record.get("path").is_none());
        assert!(record.get("source").is_none());
        if record["event"] == "end" {
            assert_eq!(record["status"], "ok");
        }
    }
}

#[test]
fn static_input_counters_use_camel_case_at_creation_and_later_recording() {
    let records = capture(|| {
        let span = tracing::info_span!(
            "output.input-read",
            input_paths = 2u64,
            read_bytes = tracing::field::Empty,
            retained_bytes = 3u64
        );
        let _scope = span.enter();
        span.record("read_bytes", 5u64);
        span.record("retained_bytes", 8u64);
    });
    assert_eq!(records.len(), 2);
    assert_eq!(records[0]["inputPaths"], 2);
    assert_eq!(records[0]["retainedBytes"], 3);
    assert!(records[0].get("readBytes").is_none());
    assert_eq!(records[1]["inputPaths"], 2);
    assert_eq!(records[1]["readBytes"], 5);
    assert_eq!(records[1]["retainedBytes"], 8);
    for record in records {
        for name in ["input_paths", "read_bytes", "retained_bytes"] {
            assert!(record.get(name).is_none());
        }
    }
}
