//! Serve releases temporary memory claims when admitted calls cancel before use.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use mokly_sidecar::error::Error;
use mokly_sidecar::host_memory::HostMemoryMock;
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::{Pool, PoolMock};
use mokly_sidecar::pool_admission::PoolCapacity;
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use unimock::{MockFn, Unimock, matching};

use crate::serve_pool::{PoolScheduling, ServePool};

use super::serve_pool_support::css;

#[test]
fn cancelled_calls_release_claims_that_never_started_a_worker() {
    let memory = Arc::new(AtomicU64::new(3 * 1024 * 1024 * 1024));
    let source = Unimock::new(
        HostMemoryMock::headroom_bytes
            .each_call(matching!())
            .answers_arc(Arc::new({
                let memory = memory.clone();
                move |_| Some(memory.load(Ordering::SeqCst))
            })),
    );
    let pool = Arc::new(
        Pool::new(
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            Launch {
                capture_durability: false,
                repository: "/repo".into(),
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
    let (entered, events) = mpsc::channel();
    let mut releases = Vec::new();
    let mut waits = Vec::new();
    for _ in 0..2 {
        let (release, released) = mpsc::channel();
        releases.push(release);
        waits.push(Mutex::new(released));
    }
    let inner = Unimock::new(
        PoolMock::request
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, call| {
                let Call::ProcessCss(params) = call else {
                    panic!()
                };
                let index: usize = params.context.rsplit(':').next().unwrap().parse().unwrap();
                entered.send(index).unwrap();
                waits[index].lock().unwrap().recv().unwrap();
                Err(Error::Cancelled)
            })),
    );
    let scheduler = ServePool::new(Arc::new(inner.clone()), pool.clone());
    let head = scheduler.pool(None);
    let first = {
        let head = head.clone();
        thread::spawn(move || head.request(css("/head", 0)))
    };
    assert_eq!(events.recv().unwrap(), 0);
    let second = thread::spawn(move || head.request(css("/head", 1)));
    assert_eq!(events.recv().unwrap(), 1);
    memory.store(0, Ordering::SeqCst);
    let held_capacity = pool.capacity();
    releases[1].send(()).unwrap();
    assert!(matches!(second.join().unwrap(), Err(Error::Cancelled)));
    let after_cancellation = pool.capacity();
    releases[0].send(()).unwrap();
    assert!(matches!(first.join().unwrap(), Err(Error::Cancelled)));
    assert_eq!(held_capacity, 2);
    assert_eq!(after_cancellation, 1);
    assert_eq!(pool.capacity(), 1);
    memory.store(3 * 1024 * 1024 * 1024, Ordering::SeqCst);
    let _one = pool.try_claim().unwrap().unwrap();
    let _two = pool.try_claim().unwrap().unwrap();
    assert!(pool.try_claim().unwrap().is_none());
}
