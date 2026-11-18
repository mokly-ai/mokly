//! Serve reads the pool's prospective capacity and preserves foreground order.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use mokly_server::changes::ChangeToken;
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::pool_admission::CapacityMock;
use mokly_sidecar::pool_claim::CallClaim;
use mokly_sidecar::wire::MethodResult;
use unimock::{MockFn, Unimock, matching};

use crate::serve_pool::{PoolScheduling, ServePool};

use super::serve_pool_support::{capacity, css};

fn waiting(scheduler: &ServePool, total: usize) {
    let mut state = scheduler.gate.state.lock().unwrap();
    while state.active + state.waiting != total {
        state = scheduler.gate.changed.wait(state).unwrap();
    }
}

#[test]
fn serve_grows_after_memory_recovers_when_a_request_wakes_admission() {
    let count = Arc::new(AtomicUsize::new(1));
    let source = Unimock::new((
        CapacityMock::capacity
            .each_call(matching!())
            .answers_arc(Arc::new({
                let count = count.clone();
                move |_| count.load(Ordering::SeqCst)
            })),
        CapacityMock::try_claim
            .each_call(matching!())
            .answers(&|_| Some(CallClaim::fixed())),
    ));
    let (entered, events) = mpsc::channel();
    let mut releases = Vec::new();
    let mut waits = Vec::new();
    for _ in 0..3 {
        let (send, receive) = mpsc::channel();
        releases.push(send);
        waits.push(Mutex::new(receive));
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
                Ok(MethodResult::Empty)
            })),
    );
    let scheduler = ServePool::new(Arc::new(inner), Arc::new(source));
    let base = scheduler.pool(Some(Arc::new(ChangeToken::default())));
    let first = {
        let base = base.clone();
        thread::spawn(move || base.request(css("/base", 0)))
    };
    assert_eq!(events.recv().unwrap(), 0);
    let second = {
        let base = base.clone();
        thread::spawn(move || base.request(css("/base", 1)))
    };
    waiting(&scheduler, 2);
    assert_eq!(scheduler.gate.state.lock().unwrap().active, 1);
    count.store(3, Ordering::SeqCst);
    let third = thread::spawn(move || base.request(css("/base", 2)));
    let mut started = vec![0, events.recv().unwrap(), events.recv().unwrap()];
    started.sort();
    assert_eq!(scheduler.gate.state.lock().unwrap().active, 3);
    for release in releases {
        release.send(()).unwrap();
    }
    for job in [first, second, third] {
        assert!(matches!(job.join().unwrap().unwrap(), MethodResult::Empty));
    }
    assert_eq!(started, [0, 1, 2]);
}

#[test]
fn reduced_capacity_keeps_waiting_base_calls_behind_foreground_work() {
    let (entered, events) = mpsc::channel();
    let mut releases = Vec::new();
    let mut waits = Vec::new();
    for _ in 0..3 {
        let (send, receive) = mpsc::channel();
        releases.push(send);
        waits.push(Mutex::new(receive));
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
                Ok(MethodResult::Empty)
            })),
    );
    let scheduler = ServePool::new(Arc::new(inner), capacity(1));
    let base = scheduler.pool(Some(Arc::new(ChangeToken::default())));
    let first = {
        let base = base.clone();
        thread::spawn(move || base.request(css("/base", 0)))
    };
    assert_eq!(events.recv().unwrap(), 0);
    let second = thread::spawn(move || base.request(css("/base", 1)));
    let foreground = scheduler.pool(None);
    let head = thread::spawn(move || foreground.request(css("/head", 2)));
    {
        let mut state = scheduler.gate.state.lock().unwrap();
        while state.waiting + state.active != 3 {
            state = scheduler.gate.changed.wait(state).unwrap();
        }
        assert_eq!(state.active, 1);
    }
    releases[0].send(()).unwrap();
    assert_eq!(events.recv().unwrap(), 2);
    releases[2].send(()).unwrap();
    assert_eq!(events.recv().unwrap(), 1);
    releases[1].send(()).unwrap();
    for job in [first, second, head] {
        assert!(matches!(job.join().unwrap().unwrap(), MethodResult::Empty));
    }
}
