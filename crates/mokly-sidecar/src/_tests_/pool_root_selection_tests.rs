//! Requests without an existing context affinity reuse workers by source root.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::methods::{Call, ProcessCss};
use crate::pool::{Pool, SidecarPool};
use crate::pool_admission::PoolCapacity;
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
            capture_durability: false,
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
    assert!(!pool.lock().affinity.contains_key(&context));
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
        let affinities = pool.lock().affinity.len();
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

fn eager_call(root: &str) -> Call {
    Call::ProcessCss(ProcessCss {
        source_root: root.into(),
        context: format!("{root}:eager"),
        repository_roots: Vec::new(),
        module_resolution: Default::default(),
        postcss: "postcss.mjs".into(),
        source_path: "style.css".into(),
        text: String::new(),
    })
}

fn unstarted_pool(size: usize) -> Pool {
    Pool::new(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Launch {
            capture_durability: false,
            repository: "/head".into(),
            node: "node".into(),
            entry: "/package/sidecar.js".into(),
            version: "test".into(),
        },
        PoolOptions {
            size: size.try_into().unwrap(),
            timeout_ms: None,
        },
    )
}

#[test]
fn eager_claim_uses_no_head_or_different_base_slot() {
    let (pool, _) = pool(2);
    request(&pool, "/head", 0);
    request(&pool, "/other-base", 0);
    let claim = pool.try_eager_claim(&eager_call("/base")).unwrap();
    let admitted = claim.is_some();
    pool.abort().unwrap();
    assert!(
        !admitted,
        "eager work must preserve both occupied source roots"
    );
}

#[test]
fn eager_claim_is_serial_at_capacity_one() {
    let pool = unstarted_pool(1);
    let claim = pool.try_eager_claim(&eager_call("/base")).unwrap();
    let admitted = claim.is_some();
    pool.abort().unwrap();
    assert!(
        !admitted,
        "capacity one must leave base work for classification"
    );
}

#[test]
fn eager_claim_is_single_and_shares_the_call_budget() {
    let pool = unstarted_pool(3);
    let eager = pool.try_eager_claim(&eager_call("/base")).unwrap();
    let duplicate = pool.try_eager_claim(&eager_call("/base")).unwrap();
    let head = pool.try_claim().unwrap();
    let final_head = pool.try_claim().unwrap();
    let overflow = pool.try_claim().unwrap();
    let actual = [
        eager.is_some(),
        duplicate.is_some(),
        head.is_some(),
        final_head.is_some(),
        overflow.is_some(),
    ];
    pool.abort().unwrap();
    assert_eq!(actual, [true, false, true, true, false]);
}

#[test]
fn a_newer_matching_worker_wins_over_the_oldest_idle_other_root() {
    let (pool, events) = pool(2);
    request(&pool, "/head", 0);
    request(&pool, "/base", 0);
    request(&pool, "/head", 1);
    let idle = pool.lock().available.iter().copied().collect::<Vec<_>>();
    request(&pool, "/head", 2);
    let observed = events.lock().unwrap().clone();
    pool.abort().unwrap();
    assert_eq!(idle, [1, 0]);
    assert_eq!(
        observed,
        [Event::Spawn("/head".into()), Event::Spawn("/base".into())]
    );
}
