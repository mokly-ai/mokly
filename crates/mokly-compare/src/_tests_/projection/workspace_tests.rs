//! Historical eligibility and deduplicated affected consumers use one shared policy.

use mokly_model::axes::{ColorScheme, EntryKind, Viewport};
use mokly_model::public_detail::InputChange;
use mokly_model::review::{ReviewEntryAddress, ReviewState};
use mokly_model::review_affected::{
    AffectedConsumer, AffectedConsumerAddress, AffectedInstance, AffectedUsageEvidence,
    ComponentUsageContext, ConsumerKind, ReviewSide,
};

use crate::projection_workspace;

use super::support::{classified, details, entry, result};

fn effect(path: &str, kind: ConsumerKind) -> AffectedConsumer {
    AffectedConsumer {
        changed_component_id: "button".into(),
        consumer: AffectedConsumerAddress {
            path: path.into(),
            kind,
        },
        evidence: vec![AffectedUsageEvidence {
            side: ReviewSide::Before,
            context: ComponentUsageContext {
                kind,
                entry: ReviewEntryAddress {
                    path: path.into(),
                    title: path.into(),
                    props: None,
                    supplied_slots: None,
                },
                viewport: Viewport::Desktop,
                color_scheme: ColorScheme::Light,
            },
            via: vec![AffectedInstance {
                component_id: "button".into(),
                instance_key: "a".repeat(64),
            }],
        }],
    }
}

#[test]
fn only_removed_component_variants_can_compare_even_when_removals_are_affected() {
    for (kind, parent, eligible) in [
        (EntryKind::Screen, None, false),
        (EntryKind::Component, None, false),
        (EntryKind::Component, Some("button"), true),
    ] {
        let button = entry("button", EntryKind::Component, None);
        let path = if parent.is_some() {
            "button/removed"
        } else {
            "removed"
        };
        let removed = entry(path, kind, parent);
        let mut result = result(
            vec![button.clone(), removed],
            vec![button],
            vec![
                classified("button", EntryKind::Component, ReviewState::Changed),
                classified(path, kind, ReviewState::Removed),
            ],
        );
        result.review.affected.push(effect(
            path,
            if kind == EntryKind::Screen {
                ConsumerKind::Screen
            } else {
                ConsumerKind::Component
            },
        ));
        let mut historical = details(&result.before.catalogue().model);
        projection_workspace::apply(&mut historical, &result).unwrap();
        assert_eq!(
            historical[path]
                .workspace
                .as_ref()
                .unwrap()
                .comparison_eligible,
            eligible
        );
        assert_eq!(
            historical["button"].workspace.as_ref().unwrap().affected[0].comparison_eligible,
            eligible
        );
    }
}

#[test]
fn affected_only_consumers_are_eligible_and_duplicate_links_keep_first_seen_order() {
    let button = entry("button", EntryKind::Component, None);
    let home = entry("home", EntryKind::Screen, None);
    let mut home_change = classified("home", EntryKind::Screen, ReviewState::Unchanged);
    home_change.included = false;
    let mut result = result(
        vec![button.clone(), home.clone()],
        vec![button, home],
        vec![
            classified("button", EntryKind::Component, ReviewState::Changed),
            home_change,
        ],
    );
    assert_eq!(result.snapshot.changed_entries, vec!["button"]);
    let mut first = effect("home", ConsumerKind::Screen);
    let mut after = first.evidence[0].clone();
    after.side = ReviewSide::After;
    first.evidence.push(after.clone());
    first.evidence.push(after);
    result.review.affected = vec![first.clone(), first];
    let mut current = details(&result.after.catalogue().model);
    projection_workspace::apply(&mut current, &result).unwrap();
    assert!(
        current["home"]
            .workspace
            .as_ref()
            .unwrap()
            .comparison_eligible
    );
    assert_eq!(
        current["home"]
            .workspace
            .as_ref()
            .unwrap()
            .related_components
            .len(),
        1
    );
    assert_eq!(
        current["button"].workspace.as_ref().unwrap().affected.len(),
        1
    );
    assert!(!current["button"].workspace.as_ref().unwrap().affected[0].removed);
    current
        .get_mut("home")
        .unwrap()
        .workspace
        .as_mut()
        .unwrap()
        .input_changes
        .push(InputChange {
            instance_id: "stale".into(),
            title: "stale".into(),
            viewport: Viewport::Desktop,
            color_scheme: ColorScheme::Light,
            variant_path: None,
            before: Default::default(),
            after: Default::default(),
        });
    projection_workspace::apply(&mut current, &result).unwrap();
    assert_eq!(
        current["button"].workspace.as_ref().unwrap().affected.len(),
        1
    );
    assert_eq!(
        current["home"]
            .workspace
            .as_ref()
            .unwrap()
            .related_components
            .len(),
        1
    );
    assert!(
        current["home"]
            .workspace
            .as_ref()
            .unwrap()
            .input_changes
            .is_empty()
    );
}
