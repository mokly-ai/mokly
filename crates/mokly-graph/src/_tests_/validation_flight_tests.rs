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
    let second = {
        let first = validation::flight(&probe.session, &key);
        let second = validation::flight(&probe.session, &key);
        {
            let _guard = first.lock().unwrap();
            assert!(matches!(second.try_lock(), Err(TryLockError::WouldBlock)));
            let other_key = NodeKey("other".into());
            let other = validation::flight(&probe.session, &other_key);
            assert!(other.try_lock().is_ok());
            validation::release(&probe.session, &other_key, &other);
        }
        validation::release(&probe.session, &key, &first);
        second
    };
    {
        let same = validation::flight(&probe.session, &key);
        assert!(Arc::ptr_eq(&same, &second));
        validation::release(&probe.session, &key, &same);
    }
    assert!(second.try_lock().is_ok());
    validation::release(&probe.session, &key, &second);
    let fresh = validation::flight(&probe.session, &key);
    assert!(!Arc::ptr_eq(&fresh, &second));
    validation::release(&probe.session, &key, &fresh);
}

#[test]
fn different_generations_do_not_wait_on_each_others_target_requests() {
    let first = prepared();
    let second = prepared();
    let key = NodeKey("same key".into());
    let left = validation::flight(&first.session, &key);
    let right = validation::flight(&second.session, &key);
    {
        let _guard = left.lock().unwrap();
        assert!(right.try_lock().is_ok());
    }
    validation::release(&first.session, &key, &left);
    validation::release(&second.session, &key, &right);
}
