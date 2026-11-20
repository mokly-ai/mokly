//! Existing process mocks keep busy slots leased without clocks or threads.

use crate::methods::{Call, Generation};
use crate::pool::{Pool, SidecarPool};
use crate::pool_start::StartLease;
use crate::pool_state::Slot;

use super::super::process::Mode;
use super::super::support::{Event, Harness, bundle, css};

pub(super) type Held = (usize, Option<Slot>, Option<StartLease>);

pub(super) fn hold(pool: &Pool, root: &str) -> Held {
    pool.acquire(
        &Call::Dispose(Generation {
            generation: "unused".into(),
        }),
        Some(root.as_ref()),
        None,
    )
    .unwrap()
}

pub(super) fn hold_newest(pool: &Pool) -> Held {
    pool.acquire(
        &css("/head", "newest-context"),
        Some("/head".as_ref()),
        None,
    )
    .unwrap()
}

pub(super) fn release(pool: &Pool, held: Held) {
    pool.release(held.0, held.1, held.2);
}

pub(super) fn prime(pool: &Pool) {
    pool.request(bundle("/head", "older")).unwrap();
    let older = hold(pool, "/head");
    pool.request(bundle("/head", "newest")).unwrap();
    pool.request(css("/head", "newest-context")).unwrap();
    release(pool, older);
}

pub(super) fn three() -> Harness {
    let harness = Harness::plain(3, &[Mode::Foreground; 3]);
    let pool = &harness.pool;
    prime(pool);
    let newest = hold_newest(pool);
    let older = hold(pool, "/head");
    pool.request(css("/head", "uncompiled")).unwrap();
    release(pool, older);
    release(pool, newest);
    harness
}

pub(super) fn requests(harness: &Harness, label: &str) -> Vec<Event> {
    harness
        .events
        .read()
        .into_iter()
        .filter(|event| matches!(event, Event::Request(_, value) if value == label))
        .collect()
}
