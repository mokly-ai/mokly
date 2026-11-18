//! A gate-admitted call must start after memory falls before it reaches the pool.

use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use mokly_sidecar::error::Result;
use mokly_sidecar::host_memory::HostMemoryMock;
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::{Pool, PoolMock, SidecarPool};
use mokly_sidecar::pool_claim::CallClaim;
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::results::Css;
use mokly_sidecar::wire::MethodResult;
use mokly_sidecar::workers::{ControlMock, FactoryMock, Spawned, WorkerMock};
use unimock::{MockFn, Unimock, matching};

use crate::serve_pool::{PoolScheduling, ServePool};

use super::serve_pool_support::css;

#[derive(Debug, PartialEq, Eq)]
enum Event {
    Request(usize),
    End(usize),
    LowReading,
}

fn forward(
    pool: &Pool,
    memory: &AtomicU64,
    call: Call,
    claim: Option<&CallClaim>,
) -> Result<MethodResult> {
    let Call::ProcessCss(params) = &call else {
        panic!()
    };
    if params.context.ends_with(":1") {
        memory.store(0, Ordering::SeqCst);
    }
    match claim {
        Some(claim) => pool.request_claimed(call, claim),
        None => pool.request(call),
    }
}

#[test]
fn a_gate_claim_starts_the_second_worker_before_the_busy_worker_finishes() {
    let memory = Arc::new(AtomicU64::new(3 * 1024 * 1024 * 1024));
    let starts = Arc::new(AtomicUsize::new(0));
    let low_reads = Arc::new(AtomicUsize::new(0));
    let (send, events) = mpsc::channel();
    let mut releases = Vec::new();
    let mut waits = Vec::new();
    for _ in 0..2 {
        let (release, released) = mpsc::channel();
        releases.push(release);
        waits.push(Mutex::new(released));
    }
    let waits = Arc::new(waits);
    let source = Unimock::new(
        HostMemoryMock::headroom_bytes
            .each_call(matching!())
            .answers_arc(Arc::new({
                let memory = memory.clone();
                let low_reads = low_reads.clone();
                let release = releases[0].clone();
                let send = send.clone();
                move |_| {
                    let bytes = memory.load(Ordering::SeqCst);
                    if bytes == 0 {
                        match low_reads.fetch_add(1, Ordering::SeqCst) {
                            0 => send.send(Event::LowReading).unwrap(),
                            1 => release.send(()).unwrap(),
                            _ => {}
                        }
                    }
                    Some(bytes)
                }
            })),
    );
    let factory = Unimock::new(
        FactoryMock::spawn
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let starts = starts.clone();
                move |_, _| {
                    starts.fetch_add(1, Ordering::SeqCst);
                    let worker = Unimock::new((
                        WorkerMock::handshake
                            .each_call(matching!(_))
                            .answers(&|_, _| Ok(())),
                        WorkerMock::resident_bytes
                            .each_call(matching!())
                            .answers(&|_| Ok(0)),
                        ControlMock::resident_bytes
                            .each_call(matching!())
                            .answers(&|_| Ok(0)),
                        WorkerMock::request
                            .each_call(matching!(_, _))
                            .answers_arc(Arc::new({
                                let waits = waits.clone();
                                let send = send.clone();
                                move |_, request, _| {
                                    let Call::ProcessCss(params) = &request.call else {
                                        panic!()
                                    };
                                    let index: usize =
                                        params.context.rsplit(':').next().unwrap().parse().unwrap();
                                    send.send(Event::Request(index)).unwrap();
                                    waits[index].lock().unwrap().recv().unwrap();
                                    send.send(Event::End(index)).unwrap();
                                    Ok(MethodResult::Css(Css {
                                        read_evidence: Default::default(),
                                        unmapped_dependency_directories: None,
                                        text: index.to_string(),
                                        dependencies: vec![],
                                    }))
                                }
                            })),
                    ))
                    .no_verify_in_drop();
                    Ok(Spawned {
                        worker: Box::new(worker.clone()),
                        control: Arc::new(worker),
                    })
                }
            })),
    )
    .no_verify_in_drop();
    let pool = Arc::new(
        Pool::new(
            Arc::new(factory),
            Arc::new(Unimock::new(())),
            Launch {
                capture_durability: false,
                repository: "/head".into(),
                node: "node".into(),
                entry: "sidecar.js".into(),
                version: "test".into(),
            },
            PoolOptions {
                size: 3.try_into().unwrap(),
                timeout_ms: None,
            },
        )
        .with_memory_admission(Arc::new(source.clone())),
    );
    let inner = Unimock::new((
        PoolMock::request_claimed
            .each_call(matching!(_, _))
            .answers_arc(Arc::new({
                let pool = pool.clone();
                let memory = memory.clone();
                move |_, call, claim| forward(&pool, &memory, call, Some(claim))
            })),
        PoolMock::request
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let pool = pool.clone();
                move |_, call| forward(&pool, &memory, call, None)
            })),
    ))
    .no_verify_in_drop();
    let scheduler = ServePool::new(Arc::new(inner), pool.clone());
    let head = scheduler.pool(None);
    let first = {
        let head = head.clone();
        thread::spawn(move || head.request(css("/head", 0)))
    };
    assert_eq!(events.recv().unwrap(), Event::Request(0));
    let second = thread::spawn(move || head.request(css("/head", 1)));
    assert_eq!(events.recv().unwrap(), Event::LowReading);
    pool.release_context("unused");
    let next = events.recv().unwrap();
    let _ = releases[0].send(());
    releases[1].send(()).unwrap();
    for job in [first, second] {
        assert!(matches!(job.join().unwrap().unwrap(), MethodResult::Css(_)));
    }
    assert_eq!(next, Event::Request(1));
    assert_eq!(starts.load(Ordering::SeqCst), 2);
}
