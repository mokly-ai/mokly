//! An over-budget path fails before Mokly builds the attribute names of its ancestors.

use std::alloc::System;

use stats_alloc::{INSTRUMENTED_SYSTEM, Region, StatsAlloc};

use mokly_git::error::Error;
use mokly_git::identity::RepoPath;
use mokly_git::tree::Limits;

mod support;
use support::Fixture;

#[global_allocator]
static GLOBAL: &StatsAlloc<System> = &INSTRUMENTED_SYSTEM;

#[test]
fn an_over_budget_lookup_returns_the_argument_limit_with_bounded_allocation() {
    let fixture = Fixture::new();
    fixture.write("site.css", b"a {}\n");
    let commit = fixture.commit();
    let repository = fixture.repository();
    // 5,000 one-character directories: 10 KB of path text. Its ancestor attribute
    // names would take about 50 MB.
    let path = RepoPath::parse(&format!("{}x.css", "a/".repeat(5_000))).unwrap();

    let region = Region::new(GLOBAL);
    let result = repository.lookup(&commit, std::slice::from_ref(&path), Limits::default());
    let stats = region.change();

    assert!(
        matches!(result, Err(Error::ArgumentLimit { limit: 16_384 })),
        "{result:?}"
    );
    assert!(
        stats.bytes_allocated < 1_000_000,
        "{} bytes allocated",
        stats.bytes_allocated
    );
}
