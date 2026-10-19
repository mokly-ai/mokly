//! Source reason equality uses the same UTF-16 target order as review projection.

use mokly_model::axes::EntryKind;
use mokly_model::review::{EntryChangeReason, ReviewEntry, ReviewKind, ReviewState};

use crate::comparison_types::EntryClassification;

use super::reasons_equal;

#[test]
fn two_non_ascii_dependency_paths_match_the_normalized_review() {
    let high = EntryChangeReason::Dependency {
        path: "static/\u{10000}.css".into(),
    };
    let low = EntryChangeReason::Dependency {
        path: "static/\u{e000}.css".into(),
    };
    let mut classification = EntryClassification {
        kind: EntryKind::Screen,
        path: "home".into(),
        previous_path: None,
        state: ReviewState::Changed,
        included: true,
        reasons: vec![low.clone(), high.clone(), low.clone()],
        documents: vec![],
    };
    let entry = ReviewEntry {
        kind: ReviewKind::Screen,
        path: "home".into(),
        title: "Home".into(),
        before: None,
        after: None,
        previous_path: None,
        state: ReviewState::Changed,
        included: true,
        reasons: vec![high, low],
        views: vec![],
        variants: None,
    };
    assert!(reasons_equal(&entry, &classification));
    classification.reasons.pop();
    classification.reasons[0] = EntryChangeReason::Dependency {
        path: "static/other.css".into(),
    };
    assert!(!reasons_equal(&entry, &classification));
}
