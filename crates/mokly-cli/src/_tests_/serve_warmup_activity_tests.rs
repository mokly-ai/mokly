//! Real shared warm-up calls retain Serve's optional-writer activity lease.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::time::Duration;

use mokly_graph::write_activity::{WriteActivityMock, WriteLease};
use mokly_sidecar::compiled::{CompiledGeneration, ReuseEvidence};
use mokly_sidecar::methods::{Bundle, BundleRequest, Call, CssModules, RenderPage};
use mokly_sidecar::pool::Pool;
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::results;
use mokly_sidecar::wire::MethodResult;
use mokly_sidecar::workers::{ControlMock, FactoryMock, Spawned, WorkerMock};
use unimock::{MockFn, Unimock, matching};

use crate::serve_pool::{BaseCompletion, PoolScheduling, ServePool};

struct Lease(Arc<AtomicUsize>);
impl WriteLease for Lease {}
impl Drop for Lease {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }
}

fn compiled() -> CompiledGeneration {
    CompiledGeneration {
        vite: None,
        toolchain: "test".into(),
        metadata_identity: None,
        reuse_evidence: Arc::new(ReuseEvidence {
            complete: true,
            durable: true,
            uncaptured: None,
            inputs: BTreeMap::new(),
        }),
        unmapped_dependency_directories: None,
        identity: "g".into(),
        code: "".into(),
        runtime_key: "test".into(),
        dependency_roots: vec![],
        css_modules: vec![],
        sources: BTreeMap::new(),
        peers: BTreeMap::new(),
        storybook_react: Default::default(),
        inputs: BTreeMap::new(),
        metadata_inputs: BTreeMap::new(),
        input_directories: BTreeMap::new(),
        metadata_directories: BTreeMap::new(),
    }
}

#[test]
fn a_real_shared_warmup_call_retains_writer_activity_without_admitting_the_store_record() {
    let active = Arc::new(AtomicUsize::new(0));
    let busy = active.clone();
    let activity = Unimock::new(WriteActivityMock::enter.each_call(matching!()).answers_arc(
        Arc::new(move |_| {
            busy.fetch_add(1, Ordering::SeqCst);
            Box::new(Lease(busy.clone())) as Box<dyn WriteLease>
        }),
    ));
    let quiet = Arc::new(AtomicUsize::new(0));
    let counted = quiet.clone();
    let (started, entered) = mpsc::channel();
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let process = Unimock::new((
        WorkerMock::handshake
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
        WorkerMock::request
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| {
                if request.quiet {
                    counted.fetch_add(1, Ordering::SeqCst);
                    started.send(()).unwrap();
                    released.lock().unwrap().recv().unwrap();
                }
                Ok(match request.call {
                    Call::Bundle(_) => MethodResult::Bundle(Box::new(results::Bundle {
                        plan: None,
                        generation: "g".into(),
                        epoch: 0,
                        cache: None,
                        compile_count: 1,
                        compiled: Arc::new(compiled()),
                        modules: Default::default(),
                        unmapped_dependency_directories: None,
                    })),
                    _ => MethodResult::Empty,
                })
            })),
        WorkerMock::resident_bytes
            .each_call(matching!())
            .answers(&|_| Ok(0)),
        ControlMock::kill
            .each_call(matching!())
            .answers(&|_| Ok(())),
        ControlMock::finish
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
    ))
    .no_verify_in_drop();
    let child = process.clone();
    let factory = Unimock::new(
        FactoryMock::spawn
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                Ok(Spawned {
                    worker: Box::new(child.clone()),
                    control: Arc::new(child.clone()),
                })
            })),
    );
    let clock = Unimock::new(());
    let pool = Arc::new(Pool::new(
        Arc::new(factory.clone()),
        Arc::new(clock.clone()),
        Launch {
            capture_durability: false,
            repository: "/head".into(),
            node: "node".into(),
            entry: "sidecar.js".into(),
            version: "test".into(),
        },
        PoolOptions {
            size: 1.try_into().unwrap(),
            timeout_ms: None,
        },
    ));
    let scheduler = ServePool::new(pool.clone(), pool).with_activity(Arc::new(activity.clone()));
    let head = scheduler.pool(None);
    head.request(Call::Bundle(BundleRequest {
        preparation: None,
        params: Bundle {
            vite: false,
            source_root: "/head".into(),
            configuration_directory: ".".into(),
            entry_files: vec!["entry.tsx".into()],
            renderer: None,
            stories_files: vec![],
            storybook_folders: Default::default(),
            module_resolution: Default::default(),
            repository_roots: vec![],
            evaluation: None,
        },
        capture: None,
        plan: None,
    }))
    .unwrap();
    head.request(Call::CssModules(CssModules {
        generation: "g".into(),
        class_maps: BTreeMap::new(),
    }))
    .unwrap();
    head.request(Call::Bindings(mokly_sidecar::bindings::Bindings {
        generation: "g".into(),
        entries: BTreeMap::new(),
    }))
    .unwrap();
    head.record_served_render(
        Path::new("/head"),
        Call::RenderPage(RenderPage {
            generation: "g".into(),
            handle: "entry.tsx#Page".into(),
        }),
    );
    let wake = scheduler
        .gate
        .return_wake
        .lock()
        .unwrap()
        .as_ref()
        .unwrap()
        .clone();
    wake.synchronize();
    assert_eq!(
        quiet.load(Ordering::SeqCst),
        0,
        "a store record cannot start maintenance"
    );
    assert_eq!(
        active.load(Ordering::SeqCst),
        0,
        "a store record acquires no call claim or activity"
    );
    scheduler.base_finished();
    entered.recv_timeout(Duration::from_secs(10)).unwrap();
    let during_call = active.load(Ordering::SeqCst);
    release.send(()).unwrap();
    wake.synchronize();
    let after_call = active.load(Ordering::SeqCst);
    head.abort().unwrap();
    assert_eq!(
        during_call, 1,
        "the optional writer remains suppressed during the real warm-up call"
    );
    assert_eq!(after_call, 0, "maintenance releases suppression when idle");
    assert_eq!(quiet.load(Ordering::SeqCst), 1);
}
