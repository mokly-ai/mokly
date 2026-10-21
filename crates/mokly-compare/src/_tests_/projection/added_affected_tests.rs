//! Added affected views open Current without a comparison request.

use mokly_model::axes::{ColorScheme, EntryKind, Viewport};
use mokly_model::review::ReviewState;
use mokly_model::review_affected::ReviewSide;

use crate::comparison_types::ViewKey;

use super::affected_reference_tests::{evidence, evidence_at, links};
use super::support::{classified, entry, result};

#[test]
fn an_added_component_consumer_does_not_request_a_comparison() {
    let badge = entry("badge", EntryKind::Component, None);
    let consumer = entry("new/status", EntryKind::Component, None);
    let mut result = result(
        vec![badge.clone()],
        vec![badge, consumer],
        vec![
            classified("badge", EntryKind::Component, ReviewState::Changed),
            classified("new/status", EntryKind::Component, ReviewState::Added),
        ],
    );
    let projected = links(
        &mut result,
        "new/status",
        vec![evidence(ReviewSide::After, "new/status")],
    );
    assert_eq!(projected.len(), 1);
    assert!(!projected[0].comparison_eligible);
}

#[test]
fn an_added_view_is_ineligible_but_an_unchanged_view_can_compare() {
    let badge = entry("badge", EntryKind::Component, None);
    let consumer = entry("status", EntryKind::Component, None);
    let mut classification = classified("status", EntryKind::Component, ReviewState::Unchanged);
    let mut added = classification.documents[0].clone();
    added.key = ViewKey {
        viewport: Some(Viewport::Mobile),
        color_scheme: ColorScheme::Light,
    };
    added.before_route = None;
    added.state = ReviewState::Added;
    classification.documents.push(added);
    let mut result = result(
        vec![badge.clone(), consumer.clone()],
        vec![badge, consumer],
        vec![
            classified("badge", EntryKind::Component, ReviewState::Changed),
            classification,
        ],
    );
    let projected = links(
        &mut result,
        "status",
        vec![
            evidence_at(ReviewSide::After, "status", Viewport::Mobile),
            evidence_at(ReviewSide::After, "status", Viewport::Desktop),
        ],
    );
    assert_eq!(projected.len(), 2);
    assert!(
        !projected
            .iter()
            .find(|link| link.viewport == Viewport::Mobile)
            .unwrap()
            .comparison_eligible
    );
    assert!(
        projected
            .iter()
            .find(|link| link.viewport == Viewport::Desktop)
            .unwrap()
            .comparison_eligible
    );
}
