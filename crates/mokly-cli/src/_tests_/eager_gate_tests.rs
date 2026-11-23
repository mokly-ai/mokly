//! Real Serve admission preserves phase, HTTP, head priority, and single eager ownership.

use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use mokly_server::changes::{ChangeCancellation, ChangeToken};
use mokly_server::foreground::Foreground;
use mokly_sidecar::error::Error;
use mokly_sidecar::pool::{PoolMock, SidecarPool};
use mokly_sidecar::wire::MethodResult;
use unimock::{MockFn, Unimock, matching};

use crate::serve_eager_admission::{EagerAdmission, PreparationAdmission};
use crate::serve_pool::{PoolScheduling, ServePool};

use super::serve_pool_support::{capacity, css};

fn queued(pool: &ServePool, count: usize) -> usize {
    let mut state = pool.gate.state.lock().unwrap();
    while state.active + state.waiting != count {
        state = pool.gate.changed.wait(state).unwrap();
    }
    state.active
}

fn inner(count: usize) -> (Arc<dyn SidecarPool>, Vec<mpsc::Sender<()>>) {
    inner_calls(count, true)
}

fn inner_calls(count: usize, required: bool) -> (Arc<dyn SidecarPool>, Vec<mpsc::Sender<()>>) {
    let mut releases = Vec::new();
    let mut waits = Vec::new();
    for _ in 0..count {
        let (release, wait) = mpsc::channel();
        releases.push(release);
        waits.push(Mutex::new(wait));
    }
    let inner = Unimock::new(
        PoolMock::request
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, call| {
                let mokly_sidecar::methods::Call::ProcessCss(params) = call else {
                    panic!()
                };
                let index: usize = params.context.rsplit(':').next().unwrap().parse().unwrap();
                waits[index].lock().unwrap().recv().unwrap();
                Ok(MethodResult::Empty)
            })),
    );
    let inner = if required {
        inner
    } else {
        inner.no_verify_in_drop()
    };
    (Arc::new(inner), releases)
}

#[test]
fn eager_gate_waits_for_small_pool_dispatch_and_capacity_one_adoption() {
    for count in [1, 2, 3] {
        let (inner, releases) = inner(1);
        let scheduler = ServePool::new(inner, capacity(count));
        let phase = Arc::new(PreparationAdmission::default());
        let pool = scheduler.eager_pool(Arc::new(ChangeToken::default()), phase.clone());
        let run = thread::spawn(move || pool.request(css("/base", 0)).unwrap());
        let before = queued(&scheduler, 1);
        if count == 1 {
            phase.adopt();
        } else {
            phase.dispatched();
        }
        releases[0].send(()).unwrap();
        assert!(matches!(run.join().unwrap(), MethodResult::Empty));
        assert_eq!(
            before, 0,
            "capacity {count} must wait for its phase boundary"
        );
    }
}

#[test]
fn eager_gate_can_overlap_an_active_head_call_at_capacity_four() {
    let (inner, releases) = inner(2);
    let scheduler = ServePool::new(inner, capacity(4));
    let head = scheduler.pool(None);
    let head = thread::spawn(move || head.request(css("/head", 0)).unwrap());
    queued(&scheduler, 1);
    let pool = scheduler.eager_pool(
        Arc::new(ChangeToken::default()),
        Arc::new(PreparationAdmission::default()),
    );
    let eager = thread::spawn(move || pool.request(css("/base", 1)).unwrap());
    let active = queued(&scheduler, 2);
    for release in releases {
        release.send(()).unwrap();
    }
    head.join().unwrap();
    eager.join().unwrap();
    assert_eq!(
        active, 2,
        "an active head call is not a whole HTTP render lease"
    );
}

#[test]
fn eager_gate_holds_only_one_pending_call_claim() {
    let (inner, releases) = inner(2);
    let scheduler = ServePool::new(inner, capacity(4));
    let phase = Arc::new(PreparationAdmission::default());
    let first = scheduler.eager_pool(Arc::new(ChangeToken::default()), phase.clone());
    let first = thread::spawn(move || first.request(css("/base", 0)).unwrap());
    queued(&scheduler, 1);
    let second = scheduler.eager_pool(Arc::new(ChangeToken::default()), phase);
    let second = thread::spawn(move || second.request(css("/base", 1)).unwrap());
    let active = queued(&scheduler, 2);
    for release in releases {
        release.send(()).unwrap();
    }
    first.join().unwrap();
    second.join().unwrap();
    assert_eq!(active, 1, "only one eager call can hold a claim");
}

#[test]
fn eager_gate_waits_for_the_whole_http_lease_and_cancellation_wakes_it() {
    let (inner, releases) = inner_calls(1, false);
    let scheduler = ServePool::new(inner, capacity(4));
    let http = scheduler.enter();
    let cancel = Arc::new(ChangeToken::default());
    let pool = scheduler.eager_pool(cancel.clone(), Arc::new(PreparationAdmission::default()));
    let run = thread::spawn(move || pool.request(css("/base", 0)));
    let active = queued(&scheduler, 1);
    cancel.cancel();
    releases[0].send(()).unwrap();
    let result = run.join().unwrap();
    let _http = http;
    assert_eq!(
        active, 0,
        "a whole HTTP render owns priority between its sidecar calls"
    );
    assert!(matches!(result, Err(Error::Cancelled)));
}
