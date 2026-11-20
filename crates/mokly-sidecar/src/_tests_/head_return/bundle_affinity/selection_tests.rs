//! Compilation rank stays inside idle source-root selection.

use crate::pool::SidecarPool;

use super::super::process::Mode;
use super::super::support::{Event, Harness, bundle, css};
use super::support::{hold, hold_newest, release, requests, three};

#[test]
fn head_bundles_prefer_the_newest_idle_compiler() {
    let harness = three();
    harness.pool.request(bundle("/head", "probe")).unwrap();
    let selected = requests(&harness, "probe");
    harness.pool.abort().unwrap();
    assert_eq!(selected, [Event::Request(1, "probe".into())]);
}

#[test]
fn busy_newest_head_compiler_falls_back_to_the_next_newest_without_waiting() {
    let harness = three();
    let newest = hold_newest(&harness.pool);
    harness.pool.request(bundle("/head", "probe")).unwrap();
    let selected = requests(&harness, "probe");
    release(&harness.pool, newest);
    harness.pool.abort().unwrap();
    assert_eq!(selected, [Event::Request(0, "probe".into())]);
}

#[test]
fn base_bundles_keep_fifo_and_head_compilers_stay_in_their_root() {
    let harness = Harness::plain(3, &[Mode::Foreground; 3]);
    let pool = &harness.pool;
    pool.request(bundle("/head", "head")).unwrap();
    pool.request(bundle("/base", "older-base")).unwrap();
    let older = hold(pool, "/base");
    pool.request(bundle("/base", "newest-base")).unwrap();
    release(pool, older);
    pool.request(css("/base", "rotate")).unwrap();
    pool.request(bundle("/base", "base-probe")).unwrap();
    pool.request(bundle("/head", "head-probe")).unwrap();
    let base = requests(&harness, "base-probe");
    let head = requests(&harness, "head-probe");
    pool.abort().unwrap();
    assert_eq!(base, [Event::Request(1, "base-probe".into())]);
    assert_eq!(head, [Event::Request(0, "head-probe".into())]);
}
