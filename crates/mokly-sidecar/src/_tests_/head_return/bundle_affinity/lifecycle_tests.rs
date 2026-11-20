//! A fresh process cannot inherit its predecessor's compilation preference.

use crate::error::Error;
use crate::pool::SidecarPool;

use super::super::process::Mode;
use super::super::support::{Event, Harness, bundle, css, install, render};
use super::support::{hold, hold_newest, prime, release, requests};

#[test]
fn a_recycled_compiler_does_not_rank_the_new_process_in_its_slot() {
    let harness = Harness::plain(2, &[Mode::Foreground, Mode::IdleShutdown, Mode::Foreground]);
    let pool = &harness.pool;
    prime(pool);
    install(pool.as_ref(), "newest");
    for _ in 0..500 {
        pool.request(render("newest")).unwrap();
    }
    let older = hold(pool, "/head");
    pool.request(css("/head", "replacement")).unwrap();
    release(pool, older);
    pool.request(bundle("/head", "probe")).unwrap();
    let selected = requests(&harness, "probe");
    pool.abort().unwrap();
    assert_eq!(selected, [Event::Request(0, "probe".into())]);
}

#[test]
fn a_root_replacement_cannot_inherit_the_newest_compilation() {
    let harness = Harness::plain(2, &[Mode::Foreground; 4]);
    let pool = &harness.pool;
    prime(pool);
    let newest = hold_newest(pool);
    let older = hold(pool, "/head");
    release(pool, newest);
    pool.request(css("/base", "replace-head")).unwrap();
    pool.request(css("/head", "replace-base")).unwrap();
    release(pool, older);
    pool.request(bundle("/head", "probe")).unwrap();
    let selected = requests(&harness, "probe");
    pool.abort().unwrap();
    assert_eq!(selected, [Event::Request(0, "probe".into())]);
}

#[test]
fn a_reaped_compiler_does_not_rank_its_replacement() {
    let harness = Harness::plain(2, &[Mode::Foreground, Mode::Base, Mode::Foreground]);
    let pool = &harness.pool;
    prime(pool);
    let newest = hold_newest(pool);
    pool.retire_return(newest.0, newest.1.as_ref().unwrap().control.as_ref())
        .unwrap();
    let older = hold(pool, "/head");
    pool.release(newest.0, None, newest.2);
    pool.request(css("/head", "replacement")).unwrap();
    release(pool, older);
    pool.request(bundle("/head", "probe")).unwrap();
    let selected = requests(&harness, "probe");
    pool.abort().unwrap();
    assert_eq!(selected, [Event::Request(0, "probe".into())]);
}

#[test]
fn a_retired_compiler_leaves_the_surviving_compiler_preferred() {
    let harness = Harness::fault(
        3,
        &[Mode::IdleShutdown, Mode::Retired, Mode::IdleShutdown],
        Event::Reap(1),
    );
    let pool = &harness.pool;
    prime(pool);
    let newest = hold_newest(pool);
    let older = hold(pool, "/head");
    pool.request(css("/head", "uncompiled")).unwrap();
    release(pool, older);
    let failure = pool.retire_return(newest.0, newest.1.as_ref().unwrap().control.as_ref());
    let retired = pool.lock().retired.iter().copied().collect::<Vec<_>>();
    let record = pool.lock().slots[1]
        .as_ref()
        .and_then(|slot| slot.last_compilation);
    pool.request(bundle("/head", "probe")).unwrap();
    let selected = requests(&harness, "probe");
    pool.shutdown().unwrap();
    assert!(matches!(failure, Err(Error::HeadReturnDisabled { source })
        if matches!(source.as_ref(), Error::Unavailable { part } if part == "injected")));
    assert_eq!(retired, [1]);
    assert_eq!(record, None);
    assert_eq!(selected, [Event::Request(0, "probe".into())]);
}
