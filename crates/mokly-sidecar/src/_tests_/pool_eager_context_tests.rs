//! An eager call of a PostCSS context reaches the process that holds the context.

use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::methods::{Bundle, BundleRequest, Call, ProcessCss};
use crate::pool::{Pool, SidecarPool};
use crate::pool_admission::PoolCapacity;
use crate::pool_options::{Launch, PoolOptions};
use crate::postcss_preparation::PostcssPreparation;
use crate::wire::MethodResult;
use crate::workers::{ControlMock, FactoryMock, Spawned, WorkerMock};

/// The spawn number of the process and the context of each request that a process receives.
type Received = Arc<Mutex<Vec<(usize, &'static str, Option<String>)>>>;

/// A pool of three slots whose processes answer every request with an empty result.
fn pool(received: Received) -> Pool {
    let spawned = Arc::new(Mutex::new(0));
    let factory = Unimock::new(
        FactoryMock::spawn
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                let process = {
                    let mut count = spawned.lock().unwrap();
                    *count += 1;
                    *count
                };
                let received = received.clone();
                let worker = Unimock::new((
                    WorkerMock::handshake
                        .next_call(matching!(30_000))
                        .returns(Ok(())),
                    WorkerMock::request
                        .each_call(matching!(_, _))
                        .answers_arc(Arc::new(move |_, request, _| {
                            let method = match request.call {
                                Call::Bundle(_) => "bundle",
                                Call::PrepareContext(_) => "prepareContext",
                                Call::ProcessCss(_) => "processCss",
                                _ => panic!("unexpected call"),
                            };
                            let context = request.call.postcss_context().map(str::to_owned);
                            received.lock().unwrap().push((process, method, context));
                            Ok(MethodResult::Empty)
                        })),
                    WorkerMock::resident_bytes
                        .each_call(matching!())
                        .answers(&|_| Ok(0)),
                    ControlMock::kill.next_call(matching!()).returns(Ok(())),
                ));
                Ok(Spawned {
                    worker: Box::new(worker.clone()),
                    control: Arc::new(worker),
                })
            })),
    );
    Pool::new(
        Arc::new(factory),
        Arc::new(Unimock::new(())),
        Launch {
            capture_durability: false,
            repository: "/head".into(),
            node: "node".into(),
            entry: "/package/sidecar.js".into(),
            version: "test".into(),
        },
        PoolOptions {
            size: 3.try_into().unwrap(),
            timeout_ms: None,
        },
    )
}

fn stylesheet(context: &str) -> Call {
    Call::ProcessCss(ProcessCss {
        source_root: "/base".into(),
        context: context.into(),
        repository_roots: vec![],
        module_resolution: Default::default(),
        postcss: "postcss.mjs".into(),
        source_path: "style.css".into(),
        text: String::new(),
    })
}

fn prepared_bundle(context: &str) -> Call {
    Call::Bundle(BundleRequest {
        params: Bundle {
            evaluation: None,
            entry_files: vec!["entry.ts".into()],
            renderer: None,
            stories_files: vec![],
            storybook_folders: Default::default(),
            source_root: "/base".into(),
            configuration_directory: ".".into(),
            repository_roots: vec![],
            module_resolution: Default::default(),
            vite: false,
            vite_inputs: None,
        },
        capture: None,
        plan: None,
        preparation: Some(PostcssPreparation {
            context: context.into(),
            postcss: "postcss.mjs".into(),
        }),
    })
}

fn eager(pool: &Pool, call: Call) {
    let claim = pool
        .try_eager_claim(&call)
        .unwrap()
        .expect("an eager claim");
    pool.request_claimed(call, &claim).unwrap();
}

#[test]
fn an_eager_stylesheet_reaches_the_process_of_its_prepared_bundle() {
    let received = Received::default();
    let pool = pool(received.clone());
    {
        let held = stylesheet("held");
        let claim = pool
            .try_eager_claim(&held)
            .unwrap()
            .expect("an eager claim");
        pool.request(stylesheet("other")).unwrap();
        pool.request_claimed(held, &claim).unwrap();
    }
    eager(&pool, prepared_bundle("attempt"));
    eager(&pool, stylesheet("attempt"));
    let received = received.lock().unwrap().clone();
    pool.abort().unwrap();
    let processes = |method| {
        received
            .iter()
            .filter(|(_, called, context)| {
                *called == method && context.as_deref() == Some("attempt")
            })
            .map(|(process, ..)| *process)
            .collect::<Vec<_>>()
    };
    let spawned = received.iter().map(|(process, ..)| *process).max();
    assert_eq!(
        spawned,
        Some(2),
        "two processes of the base root: {received:?}"
    );
    assert_eq!(processes("prepareContext").len(), 1, "{received:?}");
    assert_eq!(
        processes("processCss"),
        processes("prepareContext"),
        "{received:?}"
    );
}
