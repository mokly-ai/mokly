//! A release task may finish after the pool drops while original mocks stay local.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Mutex, mpsc};

use unimock::{MockFn, Unimock, matching};

use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::pool_state::Slot;
use crate::wire::MethodResult;
use crate::workers::{ClockMock, ControlMock, WorkerControl, WorkerMock};

use super::Notice;

#[test]
fn release_cleanup_after_pool_drop_keeps_mock_verification_on_the_owner() {
    let (entered, started) = mpsc::sync_channel(1);
    let (resume, resumed) = mpsc::sync_channel(1);
    let resumed = Mutex::new(resumed);
    let worker = Unimock::new((
        WorkerMock::request
            .next_call(matching!(_, 30_000))
            .answers_arc(Arc::new(move |_, _, _| {
                entered.send(()).unwrap();
                resumed.lock().unwrap().recv().unwrap();
                Ok(MethodResult::Empty)
            })),
        ControlMock::shutdown.next_call(matching!()).returns(Ok(())),
        ControlMock::finish
            .next_call(matching!(2_000))
            .returns(Ok(())),
    ));
    let factory = Unimock::new(());
    let clock = Unimock::new(ClockMock::now_ms.next_call(matching!()).returns(0_u64));
    let (state, releases) = {
        let pool = Pool::new(
            Arc::new(factory.clone()),
            Arc::new(clock.clone()),
            Launch {
                node: "node".into(),
                entry: "sidecar.js".into(),
                repository: "/repo".into(),
                version: "test".into(),
            },
            PoolOptions {
                size: 1.try_into().unwrap(),
                timeout_ms: None,
            },
        );
        {
            let control: Arc<dyn WorkerControl> = Arc::new(worker.clone());
            let mut state = pool.lock().unwrap();
            state.slots.push(Some(Slot {
                source_root: "/repo".into(),
                worker: Box::new(worker.clone()),
                control: control.clone(),
                generations: BTreeMap::new(),
                maps: BTreeSet::new(),
                described: BTreeSet::new(),
                bindings: BTreeMap::new(),
                contexts: BTreeSet::from(["used".into()]),
                renders: 0,
                requests: 0,
            }));
            state.controls.insert(0, control);
            state.available.push_back(0);
            state.contexts.insert("used".into());
        }
        pool.release_context("used");
        started.recv().unwrap();
        pool.shutdown().unwrap();
        (
            Arc::downgrade(&pool.state),
            pool.releases.as_ref().unwrap().clone(),
        )
    };
    assert!(state.upgrade().is_some());
    resume.send(()).unwrap();
    let (done, completed) = mpsc::sync_channel(0);
    releases.send(Notice::Barrier(done)).unwrap();
    completed.recv().unwrap();
    assert!(state.upgrade().is_none());
}
