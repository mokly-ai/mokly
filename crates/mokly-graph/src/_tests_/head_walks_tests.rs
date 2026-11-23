//! The walk records of one generation stay within their cap and free their size when they leave.

use std::collections::BTreeSet;

use crate::head_validation::ClosureFacts;
use crate::head_walks::{LIMIT, PassWalks, WalkRecord, WalkStep};

/// More than half of the cap, so one such record fits and a second one does not.
const OVER_HALF: usize = LIMIT / 2 + 1;

/// Builds a record whose size grows with its argument through one part of the record.
type Build = fn(usize) -> WalkRecord;

fn steps(bytes: usize) -> WalkRecord {
    WalkRecord {
        steps: vec![WalkStep::Observe("s".repeat(bytes))],
        closure: ClosureFacts::default(),
    }
}

fn files(bytes: usize) -> WalkRecord {
    WalkRecord {
        steps: Vec::new(),
        closure: ClosureFacts {
            files: BTreeSet::from(["f".repeat(bytes)]),
            ..ClosureFacts::default()
        },
    }
}

#[test]
fn a_record_that_does_not_fit_beside_the_kept_ones_is_not_kept() {
    let cases: [(&str, Build); 2] = [("steps", steps), ("files", files)];
    for (label, record) in cases {
        let walks = PassWalks::default();
        walks.insert("first", record(OVER_HALF));
        walks.insert("second", record(OVER_HALF));
        assert!(
            walks.take("first").is_some(),
            "{label}: the first record fits"
        );
        assert!(
            walks.take("second").is_none(),
            "{label}: the second record is past the cap"
        );
    }
    let walks = PassWalks::default();
    walks.insert(&"r".repeat(OVER_HALF), steps(0));
    walks.insert(&"q".repeat(OVER_HALF), steps(0));
    assert!(
        walks.take(&"r".repeat(OVER_HALF)).is_some(),
        "the route counts too"
    );
    assert!(walks.take(&"q".repeat(OVER_HALF)).is_none());
    walks.insert("alone", steps(LIMIT));
    assert!(
        walks.take("alone").is_none(),
        "a record larger than the cap is never kept"
    );
}

#[test]
fn a_replaced_or_taken_record_frees_its_size() {
    let walks = PassWalks::default();
    walks.insert("view", steps(OVER_HALF));
    walks.insert("view", steps(OVER_HALF));
    assert!(
        walks.take("view").is_some(),
        "a replacement frees the size of the old record"
    );
    assert!(walks.take("view").is_none(), "a record is taken once");
    walks.insert("next", files(OVER_HALF));
    assert!(
        walks.take("next").is_some(),
        "a taken record freed its size"
    );
    walks.insert("other", steps(OVER_HALF));
    walks.insert("last", files(OVER_HALF));
    assert!(walks.take("other").is_some());
    assert!(
        walks.take("last").is_none(),
        "the cap still holds after the takes"
    );
}
