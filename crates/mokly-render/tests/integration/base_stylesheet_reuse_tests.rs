//! Equal historical CSS reuses a validated head record through the public base runtime.

use std::time::Instant;

use super::base_stylesheet_support::{CSS, Fixture, generation};

#[test]
fn equal_plain_css_from_a_real_git_base_reuses_the_head_record() {
    let started = Instant::now();
    let fixture = Fixture::new();
    let head = fixture.head.generation(fixture.head.prepare().unwrap());
    assert_eq!(
        head.resource("styles/main.css").unwrap().unwrap(),
        CSS.as_bytes()
    );

    let independent = fixture.base_runtime(false);
    let (baseline, baseline_misses) = generation(&independent, &fixture.head);
    assert_eq!(
        baseline.resource("styles/main.css").unwrap().unwrap(),
        CSS.as_bytes()
    );
    assert_eq!(baseline_misses, ["no-record"]);

    let shared = fixture.base_runtime(true);
    let (base, base_misses) = generation(&shared, &fixture.head);
    assert_eq!(
        base.resource("styles/main.css").unwrap().unwrap(),
        CSS.as_bytes()
    );
    assert_eq!(base.resource_routes(), baseline.resource_routes());
    eprintln!(
        "real Git base stylesheet reuse scenario: {:?}",
        started.elapsed()
    );
    assert_eq!(
        base_misses,
        Vec::<String>::new(),
        "an equal historical stylesheet must reuse the validated head record"
    );
}
