//! The read inventory runs outside the PostCSS cache lock, and equal inputs stay one request.

use std::collections::BTreeSet;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Instant;

use mokly_css::types::CssProcessor;
use mokly_model::material::digest;
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::{PoolMock, SidecarPool};
use mokly_sidecar::postcss_evidence::Evidence;
use mokly_sidecar::results::Css;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::postcss::PostCss;
use crate::postcss_cache::CssRecord;

use super::postcss_support::{DEADLINE, css, processor};

/// The first inventory waits while another module lookup or cached request completes.
struct Gate {
    blocked: Sender<()>,
    released: Mutex<Receiver<()>>,
    release: Sender<()>,
    first: AtomicBool,
    timed_out: AtomicBool,
}

impl Gate {
    fn pass(&self) {
        if self.first.swap(false, Ordering::SeqCst) {
            self.blocked.send(()).unwrap();
            let waited = self.released.lock().unwrap().recv_timeout(DEADLINE);
            self.timed_out.store(waited.is_err(), Ordering::SeqCst);
        } else {
            let _ = self.release.send(());
        }
    }
}

fn postcss(calls: Arc<AtomicUsize>, gate: Arc<Gate>) -> PostCss {
    let pool = Arc::new(Unimock::new((
        PoolMock::request
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, call| {
                let Call::ProcessCss(params) = call else {
                    panic!("expected a PostCSS request");
                };
                calls.fetch_add(1, Ordering::SeqCst);
                Ok(css(vec![format!(
                    "/repo/postcss-{}.mjs",
                    params.source_path
                )]))
            })),
        PoolMock::release_context
            .each_call(matching!("context"))
            .returns(()),
    )));
    let tree = Arc::new(Unimock::new(
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                gate.pass();
                Ok(None)
            })),
    ));
    processor(pool, tree)
}

/// Process `first` until its read inventory waits, then process `second` beside it.
fn overlap(first: &'static str, second: &'static str) -> (usize, bool, Vec<String>) {
    let calls = Arc::new(AtomicUsize::new(0));
    let (blocked, wait) = mpsc::channel();
    let (release, released) = mpsc::channel();
    let gate = Arc::new(Gate {
        blocked,
        released: Mutex::new(released),
        release,
        first: AtomicBool::new(true),
        timed_out: AtomicBool::new(false),
    });
    let processor = Arc::new(postcss(calls.clone(), gate.clone()));
    let background = processor.clone();
    let waiting = thread::spawn(move || {
        background
            .process(first, ".a {}", &BTreeSet::new())
            .unwrap()
            .text
    });
    wait.recv_timeout(DEADLINE).unwrap();
    let beside = if first == second {
        let key = format!("context:{second}:{}", digest(b".a {}"));
        let result = processor
            .request(&key, second, ".a {}")
            .unwrap()
            .result
            .text;
        gate.release.send(()).unwrap();
        result
    } else {
        processor
            .process(second, ".a {}", &BTreeSet::new())
            .unwrap()
            .text
    };
    let texts = vec![waiting.join().unwrap(), beside];
    (
        calls.load(Ordering::SeqCst),
        gate.timed_out.load(Ordering::SeqCst),
        texts,
    )
}

#[test]
fn another_input_reaches_the_sidecar_while_a_read_inventory_runs() {
    let (calls, timed_out, texts) = overlap("a.css", "b.css");
    assert!(!timed_out);
    assert_eq!(calls, 2);
    assert_eq!(texts, ["a{}", "a{}"]);
}

#[test]
fn an_equal_input_reuses_the_sidecar_result_while_its_read_inventory_runs() {
    let (calls, timed_out, texts) = overlap("a.css", "a.css");
    assert!(!timed_out);
    assert_eq!(calls, 1);
    assert_eq!(texts, ["a{}", "a{}"]);
}

#[test]
fn a_cached_result_returns_while_another_input_waits_for_the_sidecar() {
    let (calling, called) = mpsc::channel::<()>();
    let (finish, finished) = mpsc::channel::<()>();
    let finished = Mutex::new(finished);
    let timed_out = Arc::new(AtomicBool::new(false));
    let flag = timed_out.clone();
    let pool = Arc::new(Unimock::new((
        PoolMock::request
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, call| {
                if matches!(&call, Call::ProcessCss(params) if params.source_path == "slow.css") {
                    calling.send(()).unwrap();
                    let waited = finished.lock().unwrap().recv_timeout(DEADLINE);
                    flag.store(waited.is_err(), Ordering::SeqCst);
                }
                Ok(css(Vec::new()))
            })),
        PoolMock::release_context
            .each_call(matching!("context"))
            .returns(()),
    )));
    let processor = Arc::new(processor(pool, Arc::new(Unimock::new(()))));
    let process = |processor: &PostCss, path: &str| {
        processor
            .process(path, ".a {}", &BTreeSet::new())
            .unwrap()
            .text
    };
    assert_eq!(process(&processor, "fast.css"), "a{}");
    let background = processor.clone();
    let slow = thread::spawn(move || process(&background, "slow.css"));
    called.recv_timeout(DEADLINE).unwrap();
    assert_eq!(process(&processor, "fast.css"), "a{}");
    finish.send(()).unwrap();
    assert_eq!(slow.join().unwrap(), "a{}");
    assert!(!timed_out.load(Ordering::SeqCst));
}

#[test]
fn a_request_that_waited_for_its_turn_reuses_the_result_that_arrived_meanwhile() {
    let pool: Arc<dyn SidecarPool> = Arc::new(Unimock::new(()));
    let processor = Arc::new(processor(pool, Arc::new(Unimock::new(()))));
    let arrived = |text: &str| CssRecord {
        result: Css {
            read_evidence: Evidence::default(),
            unmapped_dependency_directories: None,
            text: text.into(),
            dependencies: Vec::new(),
        },
        processed: None,
    };
    {
        let mut cache = processor.cache.lock().unwrap();
        cache.insert("released:marker".into(), arrived("m{}"));
        cache.releases.send("released".into()).unwrap();
    }
    let waiting = {
        let _turn = processor.turns.queue.lock().unwrap();
        let background = processor.clone();
        let waiting = thread::spawn(move || {
            background
                .process("a.css", ".a {}", &BTreeSet::new())
                .unwrap()
                .text
        });
        let deadline = Instant::now() + DEADLINE;
        loop {
            {
                let mut cache = processor.cache.lock().unwrap();
                if !cache.records.contains_key("released:marker") {
                    let key = format!("context:a.css:{}", digest(b".a {}"));
                    cache.insert(key, arrived("arrived{}"));
                    break;
                }
            }
            assert!(
                Instant::now() < deadline,
                "the request never checked the cache"
            );
            thread::yield_now();
        }
        waiting
    };
    assert_eq!(waiting.join().unwrap(), "arrived{}");
}

#[test]
fn the_check_under_the_request_lock_reuses_a_result_stored_after_the_lock_was_taken() {
    let processor = Arc::new(processor(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
    ));
    let requested = {
        let mut cache = processor.cache.lock().unwrap();
        let background = processor.clone();
        let requested = thread::spawn(move || {
            background
                .request("context:a.css:key", "a.css", ".a {}")
                .unwrap()
                .result
                .text
        });
        let deadline = Instant::now() + DEADLINE;
        while processor.turns.queue.try_lock().is_ok() {
            assert!(Instant::now() < deadline, "the request never took its turn");
            thread::yield_now();
        }
        cache.insert(
            "context:a.css:key".into(),
            CssRecord {
                result: Css {
                    read_evidence: Evidence::default(),
                    unmapped_dependency_directories: None,
                    text: "stored{}".into(),
                    dependencies: Vec::new(),
                },
                processed: None,
            },
        );
        requested
    };
    assert_eq!(requested.join().unwrap(), "stored{}");
}
