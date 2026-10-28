//! The read inventory runs outside the PostCSS cache lock, and equal inputs stay one request.

use std::collections::BTreeSet;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use mokly_css::types::CssProcessor;
use mokly_sidecar::methods::{Call, ModuleResolution};
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::postcss_evidence::Evidence;
use mokly_sidecar::results::Css;
use mokly_sidecar::wire::MethodResult;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::leases::ContextLease;
use crate::postcss::PostCss;
use crate::postcss_cache::CssCache;
use crate::side::SideInputs;

const DEADLINE: Duration = Duration::from_secs(30);

/// The first read-inventory lookup waits until a second lookup starts.
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
                assert!(matches!(call, Call::ProcessCss(_)));
                calls.fetch_add(1, Ordering::SeqCst);
                Ok(MethodResult::Css(Css {
                    read_evidence: Evidence {
                        coverage: Default::default(),
                        reads: Vec::new(),
                        modules: vec!["/repo/postcss.mjs".into()],
                    },
                    unmapped_dependency_directories: None,
                    text: "a{}".into(),
                    dependencies: Vec::new(),
                }))
            })),
        PoolMock::release_context
            .each_call(matching!("context"))
            .returns(()),
    )));
    PostCss {
        usage: Arc::new(Unimock::new(())),
        lease: Arc::new(ContextLease {
            id: "context".into(),
            pool: pool.clone(),
            released: CssCache::default().releases,
            used: AtomicBool::new(false),
        }),
        pool,
        tree: Arc::new(Unimock::new(
            SourceTreeMock::project
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    gate.pass();
                    Ok(None)
                })),
        )),
        inventory_tree: Arc::new(Unimock::new(())),
        root: "/repo".into(),
        side: SideInputs {
            dependency_aliases: Default::default(),
            source_root: "/repo".into(),
            repository_roots: vec!["/repo".into()],
            module_resolution: ModuleResolution::default(),
            configuration_directory: String::new(),
            context: "context".into(),
            dependency_roots: Vec::new(),
        },
        module: "/repo/postcss.mjs".into(),
        cache: Arc::new(Mutex::new(CssCache::default())),
        resolver: Arc::new(Unimock::new(())),
    }
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
    let beside = processor
        .process(second, ".a {}", &BTreeSet::new())
        .unwrap()
        .text;
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
