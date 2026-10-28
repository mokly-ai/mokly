//! Current and removed variant workspace placement tests.

use mokly_model::axes::EntryKind;
use mokly_model::review::ReviewState;
use mokly_model::review_affected::ConsumerKind;

use crate::projection_workspace;

use super::support::{classified, details, entry, result, with_lookup};
use super::workspace_tests::effect;

#[test]
fn a_current_screen_variant_keeps_both_workspace_lists() {
    let parent = entry("home", EntryKind::Screen, None);
    let variant = entry("home/empty", EntryKind::Screen, Some("home"));
    let result = result(
        vec![parent.clone(), variant.clone()],
        vec![parent, variant],
        vec![
            classified("home", EntryKind::Screen, ReviewState::Unchanged),
            classified("home/empty", EntryKind::Screen, ReviewState::Unchanged),
        ],
    );
    let mut result = result;
    with_lookup(&mut result);
    let mut current = details(&result.after.catalogue().model);
    projection_workspace::apply(&mut current, &result).unwrap();
    let workspace = current["home/empty"].workspace.as_ref().unwrap();
    assert!(workspace.used_by.is_some());
    assert!(workspace.affected.is_some());
}

#[test]
fn a_removed_component_variant_keeps_its_parent_affected_list() {
    let parent = entry("button", EntryKind::Component, None);
    let variant = entry("button/default", EntryKind::Component, Some("button"));
    let mut result = result(
        vec![parent.clone(), variant],
        vec![parent],
        vec![
            classified("button", EntryKind::Component, ReviewState::Unchanged),
            classified("button/default", EntryKind::Component, ReviewState::Removed),
        ],
    );
    result
        .review
        .affected
        .push(effect("button/default", ConsumerKind::Component));
    with_lookup(&mut result);
    let mut details = details(&result.before.catalogue().model);
    details.get_mut("button/default").unwrap().generation = Some("f".repeat(64));
    projection_workspace::apply(&mut details, &result).unwrap();
    let parent_affected = details["button"]
        .workspace
        .as_ref()
        .unwrap()
        .affected
        .clone();
    let variant_affected = details["button/default"]
        .workspace
        .as_ref()
        .unwrap()
        .affected
        .clone();
    assert!(variant_affected.is_some());
    assert_eq!(variant_affected, parent_affected);
}
