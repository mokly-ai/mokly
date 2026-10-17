//! Requests without an existing context affinity reuse workers by source root.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::methods::{Call, ProcessCss};
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::wire::MethodResult;
use crate::workers::{ControlMock, FactoryMock, Spawned, WorkerMock};

#[derive(Clone, Debug, PartialEq, Eq)]
enum Event {
    Spawn(PathBuf),
    Kill(PathBuf),
}

fn pool(size: usize) -> (Pool, Arc<Mutex<Vec<Event>>>) {
    let events = Arc::new(Mutex::new(Vec::new()));
    let observed = events.clone();
    let factory = Unimock::new(
        FactoryMock::spawn
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, launch| {
                let root = launch.repository.clone();
                observed.lock().unwrap().push(Event::Spawn(root.clone()));
                let ended = observed.clone();
                let worker = Unimock::new((
                    WorkerMock::handshake
                        .next_call(matching!(30_000))
                        .returns(Ok(())),
                    WorkerMock::request
                        .each_call(matching!(_, _))
                        .answers(&|_, _, _| Ok(MethodResult::Empty)),
                    WorkerMock::resident_bytes
                        .each_call(matching!())
                        .answers(&|_| Ok(0)),
                    ControlMock::kill
                        .next_call(matching!())
                        .answers_arc(Arc::new(move |_| {
                            ended.lock().unwrap().push(Event::Kill(root.clone()));
                            Ok(())
                        })),
                ));
                Ok(Spawned {
                    worker: Box::new(worker.clone()),
                    control: Arc::new(worker),
                })
            })),
    );
    let pool = Pool::new(
        Arc::new(factory),
        Arc::new(Unimock::new(())),
        Launch {
            repository: "/head".into(),
            node: "node".into(),
            entry: "/package/sidecar.js".into(),
            version: "test".into(),
        },
        PoolOptions {
            size: size.try_into().unwrap(),
            timeout_ms: None,
        },
    );
    (pool, events)
}

fn request(pool: &Pool, root: &str, sequence: usize) {
    let context = format!("{root}:{sequence}");
    assert!(!pool.lock().unwrap().affinity.contains_key(&context));
    pool.request(Call::ProcessCss(ProcessCss {
        source_root: root.into(),
        context,
        repository_roots: vec![],
        module_resolution: Default::default(),
        postcss: "postcss.mjs".into(),
        source_path: "style.css".into(),
        text: String::new(),
    }))
    .unwrap();
}

#[test]
fn new_contexts_reuse_two_workers_across_alternating_source_roots() {
    for pairs in [4, 16] {
        let (pool, events) = pool(3);
        for sequence in 0..pairs {
            for root in ["/head", "/base"] {
                request(&pool, root, sequence);
            }
        }
        let affinities = pool.lock().unwrap().affinity.len();
        let observed = events.lock().unwrap().clone();
        pool.abort().unwrap();
        assert_eq!(affinities, pairs * 2);
        assert_eq!(
            observed,
            [Event::Spawn("/head".into()), Event::Spawn("/base".into())],
            "{pairs} pairs without an existing affinity"
        );
    }
}

#[test]
fn a_newer_matching_worker_wins_over_the_oldest_idle_other_root() {
    let (pool, events) = pool(2);
    request(&pool, "/head", 0);
    request(&pool, "/base", 0);
    request(&pool, "/head", 1);
    let idle = pool
        .lock()
        .unwrap()
        .available
        .iter()
        .copied()
        .collect::<Vec<_>>();
    request(&pool, "/head", 2);
    let observed = events.lock().unwrap().clone();
    pool.abort().unwrap();
    assert_eq!(idle, [1, 0]);
    assert_eq!(
        observed,
        [Event::Spawn("/head".into()), Event::Spawn("/base".into())]
    );
}
