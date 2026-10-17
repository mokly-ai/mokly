//! Entry aggregation does not redefine current identity or saved view states.

use mokly_model::axes::{ColorScheme, EntryKind, Viewport};
use mokly_model::projection::{self, ViewKey};
use mokly_model::public_metadata::{
    CatalogueChanges, ChangeKind, ChangesStatus, ComparisonSelection,
};
use mokly_model::public_records::CatalogueRecord;
use mokly_model::review::{EntryChangeReason, ReviewState};

use crate::projection_context::Context;
use crate::projection_index;

use super::support::{classified, entry, result};

#[test]
fn surviving_added_and_removed_view_aggregates_project_as_changed_for_all_kinds() {
    for kind in [EntryKind::Screen, EntryKind::Component, EntryKind::Document] {
        for state in [ReviewState::Added, ReviewState::Removed] {
            let input = entry("entry", kind, None);
            let result = result(
                vec![input.clone()],
                vec![input],
                vec![classified("entry", kind, state)],
            );
            let publication = projection_index::publication("mokly.config.json".into(), "base");
            let mut index = projection::index(
                &result.after.catalogue().model,
                &[ViewKey {
                    path: "entry".into(),
                    viewport: Some(Viewport::Desktop),
                    color_scheme: ColorScheme::Light,
                    key: "c".repeat(64),
                }],
                &publication,
            )
            .unwrap();
            projection_index::apply(&mut index, &result);
            if kind == EntryKind::Component {
                assert!(matches!(
                    index.components[0].comparison,
                    ComparisonSelection::Ready {
                        kind: ChangeKind::Changed,
                        eligible: true
                    }
                ));
            }
            let visual = match kind {
                EntryKind::Screen => Some(&index.screens[0].visual),
                EntryKind::Component => Some(&index.components[0].visual),
                _ => None,
            };
            if let Some(visual) = visual {
                let view = visual
                    .views
                    .iter()
                    .find(|view| view.viewport == Viewport::Desktop)
                    .unwrap();
                assert!(
                    matches!(view.comparison, ComparisonSelection::Ready { eligible, .. }
                    if eligible == (kind == EntryKind::Component && state == ReviewState::Removed))
                );
            }
            let records = projection_index::records(index);
            let changes = match &records["entry"] {
                CatalogueRecord::Screen(entry) => &entry.entry.changes,
                CatalogueRecord::Component(entry) => &entry.entry.changes,
                CatalogueRecord::Document(entry) => &entry.entry.changes,
                _ => unreachable!(),
            };
            assert!(matches!(
                changes,
                CatalogueChanges::Ready {
                    kind: ChangeKind::Changed,
                    included: true
                }
            ));
        }
    }
}

#[test]
fn reasons_promote_unchanged_and_ignored_but_new_and_removed_entries_keep_their_state() {
    for state in [ReviewState::Unchanged, ReviewState::IgnoredOnly] {
        let input = entry("entry", EntryKind::Screen, None);
        let mut classified = classified("entry", EntryKind::Screen, state);
        classified.reasons.push(EntryChangeReason::Implementation);
        let result = result(vec![input.clone()], vec![input], vec![classified]);
        let context = Context::new(&result);
        assert_eq!(context.kind(&result.entries[0]), ChangeKind::Changed);
        assert!(!context.eligible(&result.entries[0]));
    }
    for removed in [false, true] {
        let input = entry("entry", EntryKind::Screen, None);
        let result = result(
            if removed { vec![input.clone()] } else { vec![] },
            if removed { vec![] } else { vec![input] },
            vec![classified(
                "entry",
                EntryKind::Screen,
                if removed {
                    ReviewState::Removed
                } else {
                    ReviewState::Added
                },
            )],
        );
        let context = Context::new(&result);
        assert_eq!(
            context.kind(&result.entries[0]),
            if removed {
                ChangeKind::Removed
            } else {
                ChangeKind::Added
            }
        );
        assert!(!context.eligible(&result.entries[0]));
    }
}

#[test]
fn component_metadata_reasons_preserve_the_own_view_aggregate_in_comparison_selection() {
    for state in [ReviewState::Unchanged, ReviewState::IgnoredOnly] {
        let input = entry("entry", EntryKind::Component, None);
        let mut change = classified("entry", EntryKind::Component, state);
        change.reasons.push(EntryChangeReason::Metadata);
        let result = result(vec![input.clone()], vec![input], vec![change]);
        let publication = projection_index::publication("mokly.config.json".into(), "base");
        let mut index =
            projection::index(&result.after.catalogue().model, &[], &publication).unwrap();
        projection_index::apply(&mut index, &result);
        assert!(matches!(
            index.components[0].entry.changes,
            CatalogueChanges::Ready {
                kind: ChangeKind::Changed,
                ..
            }
        ));
        assert!(matches!(
            index.components[0].comparison,
            ComparisonSelection::Ready {
                kind: ChangeKind::Unmodified,
                eligible: false
            }
        ));
    }
}

#[test]
fn ready_projection_sets_its_pinned_ref_without_replacing_the_live_fence() {
    let input = entry("entry", EntryKind::Screen, None);
    let result = result(
        vec![input.clone()],
        vec![input],
        vec![classified("entry", EntryKind::Screen, ReviewState::Changed)],
    );
    let mut publication = projection_index::publication("mokly.config.json".into(), "stale");
    publication.changes_status = ChangesStatus::Unavailable;
    publication.live_generation = Some("f".repeat(64));
    let mut index = projection::index(&result.after.catalogue().model, &[], &publication).unwrap();
    projection_index::apply(&mut index, &result);
    assert_eq!(index.changes_status, ChangesStatus::Ready);
    assert_eq!(index.base.as_deref(), Some("base"));
    assert_eq!(index.live.unwrap().generation, "f".repeat(64));
    assert!(index.comparison_url.is_none());
}
