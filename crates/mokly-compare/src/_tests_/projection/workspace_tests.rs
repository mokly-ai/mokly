//! Historical eligibility and deduplicated affected consumers use one shared policy.

use mokly_model::axes::{ColorScheme, EntryKind, Viewport};
use mokly_model::public_detail::{InputChange, UsageLink, VisualKind};
use mokly_model::review::{ReviewEntryAddress, ReviewState};
use mokly_model::review_affected::{
    AffectedConsumer, AffectedConsumerAddress, AffectedInstance, AffectedUsageEvidence,
    ComponentUsageContext, ConsumerKind, ReviewSide,
};

use crate::projection_workspace;

use super::support::{classified, details, entry, result, with_lookup};

pub(super) fn effect(path: &str, kind: ConsumerKind) -> AffectedConsumer {
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
fn removed_components_can_compare_but_removed_screens_cannot() {
    for (kind, parent, eligible) in [
        (EntryKind::Screen, None, false),
        (EntryKind::Component, None, true),
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
        with_lookup(&mut result);
        result.review.affected.push(effect(
            path,
            if kind == EntryKind::Screen {
                ConsumerKind::Screen
            } else {
                ConsumerKind::Component
            },
        ));
        let mut historical = details(&result.before.catalogue().model);
        historical
            .get_mut("button")
            .unwrap()
            .workspace
            .as_mut()
            .unwrap()
            .used_by
            .as_mut()
            .unwrap()
            .push(UsageLink {
                entry_path: path.into(),
                entry_kind: if kind == EntryKind::Screen {
                    VisualKind::Screen
                } else {
                    VisualKind::Component
                },
                title: "Historical consumer".into(),
                viewport: Viewport::Desktop,
                color_scheme: ColorScheme::Light,
                instance_key: "a".repeat(64),
                direct: true,
                removed: true,
                comparison_eligible: !eligible,
            });
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
            historical["button"]
                .workspace
                .as_ref()
                .unwrap()
                .affected
                .as_ref()
                .unwrap()[0]
                .comparison_eligible,
            eligible
        );
        let usage = &historical["button"]
            .workspace
            .as_ref()
            .unwrap()
            .used_by
            .as_ref()
            .unwrap()[0];
        assert_eq!(usage.comparison_eligible, eligible);
        assert_eq!(usage.title, "Historical consumer");
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
    with_lookup(&mut result);
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
        current["button"]
            .workspace
            .as_ref()
            .unwrap()
            .affected
            .as_ref()
            .unwrap()
            .len(),
        1
    );
    assert!(
        !current["button"]
            .workspace
            .as_ref()
            .unwrap()
            .affected
            .as_ref()
            .unwrap()[0]
            .removed
    );
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
        current["button"]
            .workspace
            .as_ref()
            .unwrap()
            .affected
            .as_ref()
            .unwrap()
            .len(),
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

#[test]
fn comparison_evidence_does_not_invent_a_workspace_before_usage_is_ready() {
    let button = entry("button", EntryKind::Component, None);
    let mut result = result(
        vec![button.clone()],
        vec![button],
        vec![classified(
            "button",
            EntryKind::Component,
            ReviewState::Changed,
        )],
    );
    with_lookup(&mut result);
    let mut current = details(&result.after.catalogue().model);
    current.get_mut("button").unwrap().workspace = None;
    projection_workspace::apply(&mut current, &result).unwrap();
    assert!(current["button"].workspace.is_none());
}

#[test]
fn a_current_variant_keeps_usage_but_drops_affected_lists() {
    let parent = entry("button", EntryKind::Component, None);
    let variant = entry("button/default", EntryKind::Component, Some("button"));
    let result = result(
        vec![parent.clone(), variant.clone()],
        vec![parent, variant],
        vec![
            classified("button", EntryKind::Component, ReviewState::Unchanged),
            classified(
                "button/default",
                EntryKind::Component,
                ReviewState::Unchanged,
            ),
        ],
    );
    let mut result = result;
    with_lookup(&mut result);
    let mut current = details(&result.after.catalogue().model);
    projection_workspace::apply(&mut current, &result).unwrap();
    let workspace = current["button/default"].workspace.as_ref().unwrap();
    assert!(workspace.used_by.is_some());
    assert!(workspace.affected.is_none());
}
