//! Anchor target requests share one live lock without retaining historical keys.

use std::sync::{Arc, TryLockError};

use mokly_html::links::Reference;

use crate::key::NodeKey;
use crate::validation;

use super::validation_cache_tests::{Probe, probe};

fn prepared() -> Probe {
    let probe = probe(true, false);
    validation::links(
        &probe.session,
        &[Reference {
            source_route: "caller/index.html".into(),
            target: "target".into(),
            fragment: Some("summary".into()),
        }],
    )
    .unwrap();
    probe
}

#[test]
fn a_target_serializes_live_requests_and_releases_its_lock_after_the_last_request() {
    let probe = prepared();
    let key = NodeKey("target".into());
    let retired = {
        let second = {
            let first = probe.session.state.anchor_flights.acquire(&key);
            let second = probe.session.state.anchor_flights.acquire(&key);
            {
                let _guard = first.lock().unwrap();
                assert!(matches!(second.try_lock(), Err(TryLockError::WouldBlock)));
                let other_key = NodeKey("other".into());
                let other = probe.session.state.anchor_flights.acquire(&other_key);
                assert!(other.try_lock().is_ok());
            }
            second
        };
        {
            let same = probe.session.state.anchor_flights.acquire(&key);
            assert!(Arc::ptr_eq(&same.handle(), &second.handle()));
        }
        assert!(second.try_lock().is_ok());
        second.handle()
    };
    assert!(probe.session.state.anchor_flights.is_empty());
    let fresh = probe.session.state.anchor_flights.acquire(&key);
    assert!(!Arc::ptr_eq(&fresh.handle(), &retired));
}

#[test]
fn different_generations_do_not_wait_on_each_others_target_requests() {
    let first = prepared();
    let second = prepared();
    let key = NodeKey("same key".into());
    let left = first.session.state.anchor_flights.acquire(&key);
    let right = second.session.state.anchor_flights.acquire(&key);
    {
        let _guard = left.lock().unwrap();
        assert!(right.try_lock().is_ok());
    }
}

#[test]
fn completed_requests_release_metadata_before_both_handles_are_dropped() {
    let probe = prepared();
    let key = NodeKey("overlapping cleanup".into());
    let handles = {
        let first = probe.session.state.anchor_flights.acquire(&key);
        let second = probe.session.state.anchor_flights.acquire(&key);
        [first.handle(), second.handle()]
    };
    assert_eq!(probe.session.state.anchor_flights.len(), 0);
    assert!(Arc::ptr_eq(&handles[0], &handles[1]));
}
