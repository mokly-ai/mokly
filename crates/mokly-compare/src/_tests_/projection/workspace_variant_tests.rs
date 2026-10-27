use mokly_model::axes::EntryKind;
use mokly_model::review::ReviewState;

use crate::projection_workspace;

use super::support::{classified, details, entry, result, with_lookup};

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
