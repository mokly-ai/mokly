//! Affected links retain real variant contexts through moves and removals.

use std::collections::BTreeSet;

use mokly_model::axes::{ColorScheme, EntryKind, Viewport};
use mokly_model::public_detail::UsageLink;
use mokly_model::review::{ReviewEntryAddress, ReviewState};
use mokly_model::review_affected::{
    AffectedConsumer, AffectedConsumerAddress, AffectedInstance, AffectedUsageEvidence,
    ComponentUsageContext, ConsumerKind, ReviewSide,
};

use crate::comparison_types::ComparisonResult;
use crate::move_types::{EntryPair, MovePair, Pairing};
use crate::projection_affected;
use crate::projection_context::Context;

use super::support::{
    classified, entry, paired_result, result, transferred_variant_result, with_lookup,
};

fn evidence(side: ReviewSide, path: &str) -> AffectedUsageEvidence {
    AffectedUsageEvidence {
        side,
        context: ComponentUsageContext {
            kind: ConsumerKind::Component,
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
            component_id: "badge".into(),
            instance_key: "a".repeat(64),
        }],
    }
}

fn links(
    result: &mut ComparisonResult,
    consumer: &str,
    evidence: Vec<AffectedUsageEvidence>,
) -> Vec<UsageLink> {
    with_lookup(result);
    result.review.affected = vec![AffectedConsumer {
        changed_component_id: "badge".into(),
        consumer: AffectedConsumerAddress {
            kind: ConsumerKind::Component,
            path: consumer.into(),
        },
        evidence,
    }];
    let projected = projection_affected::index(result, &Context::new(result)).unwrap();
    let links = projected.links.get("badge").cloned().unwrap_or_default();
    // Each link names a consumer whose own detail names the changed
    // component, and no other entry is a consumer.
    assert_eq!(
        projected.consumers,
        links
            .iter()
            .map(|link| link.entry_path.clone())
            .collect::<BTreeSet<_>>()
    );
    links
}

fn moved() -> ComparisonResult {
    let badge = entry("badge", EntryKind::Component, None);
    let mut parent = classified("new/status", EntryKind::Component, ReviewState::Unchanged);
    parent.previous_path = Some("old/status".into());
    parent.documents[0].before_route = Some("old/status/index.desktop.html".into());
    let mut variant = classified(
        "new/status/default",
        EntryKind::Component,
        ReviewState::Unchanged,
    );
    variant.previous_path = Some("old/status/default".into());
    variant.documents[0].before_route = Some("old/status/default/index.desktop.html".into());
    paired_result(
        vec![
            badge.clone(),
            entry("old/status", EntryKind::Component, None),
            entry(
                "old/status/default",
                EntryKind::Component,
                Some("old/status"),
            ),
        ],
        vec![
            badge,
            entry("new/status", EntryKind::Component, None),
            entry(
                "new/status/default",
                EntryKind::Component,
                Some("new/status"),
            ),
        ],
        vec![
            classified("badge", EntryKind::Component, ReviewState::Changed),
            parent,
            variant,
        ],
        Pairing {
            entries: (0..3)
                .map(|index| EntryPair {
                    before: Some(index),
                    after: Some(index),
                    moved: index > 0,
                })
                .collect(),
            moves: ["status", "status/default"]
                .into_iter()
                .map(|path| MovePair {
                    kind: EntryKind::Component,
                    path: format!("new/{path}"),
                    previous_path: format!("old/{path}"),
                })
                .collect(),
            diagnostics: vec![],
        },
    )
}

#[test]
fn affected_links_keep_parent_and_variant_destinations_with_the_same_instance_key() {
    let projected = links(
        &mut moved(),
        "new/status",
        vec![
            evidence(ReviewSide::Before, "old/status"),
            evidence(ReviewSide::Before, "old/status/default"),
            evidence(ReviewSide::After, "new/status"),
            evidence(ReviewSide::After, "new/status/default"),
        ],
    );
    assert_eq!(
        projected
            .iter()
            .map(|link| link.entry_path.as_str())
            .collect::<Vec<_>>(),
        ["new/status", "new/status/default"]
    );
    assert!(projected.iter().all(|link| !link.removed));
}

#[test]
fn before_only_variant_evidence_uses_its_accepted_move_and_current_spelling() {
    let projected = links(
        &mut moved(),
        "new/status",
        vec![evidence(ReviewSide::Before, "OLD/STATUS/DEFAULT")],
    );
    assert_eq!(projected[0].entry_path, "new/status/default");
    assert_eq!(projected[0].title, "new/status/default");
    assert!(!projected[0].removed);
}

#[test]
fn removed_variant_evidence_keeps_its_historical_destination() {
    let badge = entry("badge", EntryKind::Component, None);
    let parent = entry("status", EntryKind::Component, None);
    let mut result = result(
        vec![
            badge.clone(),
            parent.clone(),
            entry("status/old", EntryKind::Component, Some("status")),
        ],
        vec![badge, parent],
        vec![
            classified("badge", EntryKind::Component, ReviewState::Changed),
            classified("status", EntryKind::Component, ReviewState::Unchanged),
            classified("status/old", EntryKind::Component, ReviewState::Removed),
        ],
    );
    let projected = links(
        &mut result,
        "status",
        vec![evidence(ReviewSide::Before, "status/old")],
    );
    assert_eq!(projected[0].entry_path, "status/old");
    assert!(projected[0].removed);
}

#[test]
fn transitive_component_evidence_does_not_invent_a_variant_of_its_consumer() {
    let model = vec![
        entry("badge", EntryKind::Component, None),
        entry("inner", EntryKind::Component, None),
        entry("outer", EntryKind::Component, None),
        entry("outer/saved", EntryKind::Component, Some("outer")),
    ];
    let mut result = result(model.clone(), model, vec![]);
    let projected = links(
        &mut result,
        "inner",
        vec![evidence(ReviewSide::After, "outer/saved")],
    );
    assert_eq!(projected[0].entry_path, "inner");
}

#[test]
fn a_document_at_the_old_component_path_does_not_get_an_affected_link() {
    let badge = entry("badge", EntryKind::Component, None);
    let mut result = result(
        vec![badge.clone(), entry("reused", EntryKind::Component, None)],
        vec![badge, entry("reused", EntryKind::Document, None)],
        vec![],
    );
    result.pairing.entries = vec![
        EntryPair {
            before: Some(0),
            after: Some(0),
            moved: false,
        },
        EntryPair {
            before: None,
            after: Some(1),
            moved: false,
        },
    ];
    assert!(
        links(
            &mut result,
            "reused",
            vec![evidence(ReviewSide::Before, "reused")]
        )
        .is_empty()
    );
}

fn assert_transferred_variant_destination(remove_donor: bool) {
    let mut result = transferred_variant_result(remove_donor);
    let projected = links(
        &mut result,
        "donor",
        vec![evidence(ReviewSide::Before, "donor/primary")],
    );
    assert_eq!(projected.len(), 1);
    assert_eq!(projected[0].entry_path, "receiver/primary");
    assert_eq!(projected[0].title, "Transferred primary");
    assert!(!projected[0].removed);
}

#[test]
fn transferred_variant_uses_its_pair_with_a_surviving_donor() {
    assert_transferred_variant_destination(false);
}

#[test]
fn transferred_variant_uses_its_pair_with_a_removed_donor() {
    assert_transferred_variant_destination(true);
}
