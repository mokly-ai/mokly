//! Failed cleanup retires under its active caller, or without a caller when idle.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::pool::Pool;
use crate::pool_options::{Launch, PoolOptions};
use crate::pool_state::Slot;
use crate::pool_timing::Reason;
use crate::trace_capture::Trace;
use crate::workers::{ControlMock, WorkerMock};

use super::clean_idle;

#[test]
fn cleanup_retirement_keeps_only_the_cause_after_active_or_idle_failure() {
    for active in [false, true] {
        for kill_fails in [false, true] {
            let worker = Unimock::new((
                WorkerMock::request
                    .next_call(matching!(_, 30_000))
                    .returns(Err(Error::Crashed)),
                ControlMock::kill
                    .next_call(matching!())
                    .returns(if kill_fails {
                        Err(Error::Crashed)
                    } else {
                        Ok(())
                    }),
            ));
            let factory = Unimock::new(());
            let clock = Unimock::new(());
            let trace = Trace::default();
            {
                let pool = Pool::new(
                    Arc::new(factory.clone()),
                    Arc::new(clock.clone()),
                    Launch {
                        node: "private-node".into(),
                        entry: "private-entry".into(),
                        repository: "/private-root".into(),
                        version: "test".into(),
                    },
                    PoolOptions {
                        size: 1.try_into().unwrap(),
                        timeout_ms: None,
                    },
                );
                let slot = Slot {
                    source_root: "/private-root".into(),
                    worker: Box::new(worker.clone()),
                    control: Arc::new(worker.clone()),
                    generations: BTreeMap::new(),
                    maps: BTreeSet::new(),
                    described: BTreeSet::new(),
                    bindings: BTreeMap::new(),
                    contexts: BTreeSet::from(["private-context".into()]),
                    renders: 0,
                    requests: 0,
                };
                {
                    let mut state = pool.lock().unwrap();
                    state.slots.push(None);
                    state.controls.insert(0, Arc::new(worker.clone()));
                }
                tracing::subscriber::with_default(trace.clone(), || {
                    if active {
                        let caller = tracing::info_span!("caller");
                        let _scope = caller.enter();
                        pool.release(0, Some(slot)).unwrap();
                    } else {
                        {
                            let mut state = pool.lock().unwrap();
                            state.slots[0] = Some(slot);
                            state.available.push_back(0);
                        }
                        assert!(!clean_idle(&pool.state, &pool.ready, None).unwrap());
                    }
                });
                pool.synchronize_releases();
                let state = pool.lock().unwrap();
                assert!(state.slots[0].is_none());
                assert!(!state.controls.contains_key(&0));
                assert!(matches!(state.replacement_reasons[&0], Reason::Replacement));
            }
            let stops = trace.stopped();
            assert_eq!(stops.len(), 1);
            assert_eq!(stops[0].parent.is_some(), active);
            assert_eq!(stops[0].fields["reason"], "replacement");
            assert_eq!(
                stops[0].fields["status"],
                if kill_fails { "error" } else { "ok" }
            );
            assert_eq!(stops[0].fields.len(), 2);
        }
    }
}
