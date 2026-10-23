//! Added affected views open Current without a comparison request.

use mokly_model::axes::{ColorScheme, EntryKind, Viewport};
use mokly_model::catalogue::EntryContent;
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

#[test]
fn nested_consumer_links_use_their_displayed_light_fallback() {
    for (state, eligible) in [
        (ReviewState::Added, false),
        (ReviewState::Unchanged, true),
        (ReviewState::Changed, true),
    ] {
        let badge = entry("badge", EntryKind::Component, None);
        let inner = entry("inner", EntryKind::Component, None);
        let mut outer = entry("outer", EntryKind::Component, None);
        if let EntryContent::Component { visual, .. } = &mut outer.content {
            visual.color_schemes.push(ColorScheme::Dark);
        }
        let mut before = vec![badge.clone(), outer.clone()];
        if state != ReviewState::Added {
            before.push(inner.clone());
        }
        let mut outer_views = classified("outer", EntryKind::Component, ReviewState::Changed);
        let mut dark = outer_views.documents[0].clone();
        dark.key.color_scheme = ColorScheme::Dark;
        outer_views.documents.push(dark);
        let mut result = result(
            before,
            vec![badge, inner, outer],
            vec![
                classified("badge", EntryKind::Component, ReviewState::Changed),
                classified("inner", EntryKind::Component, state),
                outer_views,
            ],
        );
        let mut usage = evidence(ReviewSide::After, "outer");
        usage.context.color_scheme = ColorScheme::Dark;
        let projected = links(&mut result, "inner", vec![usage]);
        assert_eq!(projected.len(), 1);
        assert_eq!(projected[0].entry_path, "inner");
        assert_eq!(projected[0].color_scheme, ColorScheme::Dark);
        assert_eq!(projected[0].comparison_eligible, eligible, "{state:?}");
    }
}

#[test]
fn an_added_dark_view_does_not_borrow_an_unchanged_light_view() {
    let badge = entry("badge", EntryKind::Component, None);
    let consumer = entry("status", EntryKind::Component, None);
    let mut current = consumer.clone();
    if let EntryContent::Component { visual, .. } = &mut current.content {
        visual.color_schemes.push(ColorScheme::Dark);
    }
    let mut classification = classified("status", EntryKind::Component, ReviewState::Changed);
    classification.documents[0].state = ReviewState::Unchanged;
    let mut dark = classification.documents[0].clone();
    dark.key.color_scheme = ColorScheme::Dark;
    dark.before_route = None;
    dark.state = ReviewState::Added;
    classification.documents.push(dark);
    let mut result = result(
        vec![badge.clone(), consumer],
        vec![badge, current],
        vec![
            classified("badge", EntryKind::Component, ReviewState::Changed),
            classification,
        ],
    );
    let mut usage = evidence(ReviewSide::After, "status");
    usage.context.color_scheme = ColorScheme::Dark;
    let projected = links(&mut result, "status", vec![usage]);
    assert_eq!(projected.len(), 1);
    assert!(!projected[0].comparison_eligible);
}
