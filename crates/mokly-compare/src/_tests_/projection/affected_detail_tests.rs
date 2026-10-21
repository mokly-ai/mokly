//! User decision 103 C: an affected consumer's detail is the entry whose views
//! the evidence names, so a component variant's own detail names the changed
//! component and can compare, and a moved consumer keeps its current detail.

use std::collections::BTreeMap;

use mokly_model::axes::{ColorScheme, EntryKind, Viewport};
use mokly_model::public_detail::EntryDetailV2;
use mokly_model::review::{ReviewEntryAddress, ReviewState};
use mokly_model::review_affected::{
    AffectedConsumer, AffectedConsumerAddress, AffectedInstance, AffectedUsageEvidence,
    ComponentUsageContext, ConsumerKind, ReviewSide,
};

use crate::comparison_types::{ComparisonResult, EntryClassification};
use crate::move_types::{EntryPair, MovePair, Pairing};
use crate::projection_workspace;

use super::support::{classified, details, entry, paired_result, result, with_lookup};

/// One affected view of `path` on `side`, through one Badge instance.
fn evidence(side: ReviewSide, kind: ConsumerKind, path: &str) -> AffectedUsageEvidence {
    AffectedUsageEvidence {
        side,
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
            component_id: "badge".into(),
            instance_key: "a".repeat(64),
        }],
    }
}

/// Changed Badge affects `consumer` through `evidence`.
fn affected(
    consumer: &str,
    kind: ConsumerKind,
    evidence: Vec<AffectedUsageEvidence>,
) -> AffectedConsumer {
    AffectedConsumer {
        changed_component_id: "badge".into(),
        consumer: AffectedConsumerAddress {
            kind,
            path: consumer.into(),
        },
        evidence,
    }
}

/// An unchanged entry whose classification Changes does not list.
fn quiet(path: &str, kind: EntryKind) -> EntryClassification {
    let mut entry = classified(path, kind, ReviewState::Unchanged);
    entry.included = false;
    entry
}

/// A pure move of `path` from `previous`, which Changes lists.
fn moved(path: &str, previous: &str, kind: EntryKind) -> EntryClassification {
    let mut entry = classified(path, kind, ReviewState::Unchanged);
    entry.previous_path = Some(previous.into());
    entry.documents[0].before_route = Some(format!("{previous}/index.desktop.html"));
    entry
}

/// Project the current details and read each entry's eligibility and the
/// changed components that its detail names.
fn project(result: &mut ComparisonResult) -> BTreeMap<String, (bool, Vec<String>)> {
    with_lookup(result);
    let mut current = details(&result.after.catalogue().model);
    projection_workspace::apply(&mut current, result).unwrap();
    current
        .into_iter()
        .filter_map(|(path, detail): (String, EntryDetailV2)| {
            let workspace = detail.workspace?;
            let related = workspace
                .related_components
                .into_iter()
                .map(|component| component.path)
                .collect();
            Some((path, (workspace.comparison_eligible, related)))
        })
        .collect()
}

/// Badge, an unchanged Status, and Status's saved default variant.
fn status_family() -> ComparisonResult {
    let model = vec![
        entry("badge", EntryKind::Component, None),
        entry("status", EntryKind::Component, None),
        entry("status/default", EntryKind::Component, Some("status")),
    ];
    result(
        model.clone(),
        model,
        vec![
            classified("badge", EntryKind::Component, ReviewState::Changed),
            quiet("status", EntryKind::Component),
            quiet("status/default", EntryKind::Component),
        ],
    )
}

#[test]
fn variant_evidence_names_the_changed_component_in_the_variants_own_detail() {
    let mut result = status_family();
    result.review.affected = vec![affected(
        "status",
        ConsumerKind::Component,
        vec![evidence(
            ReviewSide::After,
            ConsumerKind::Component,
            "status/default",
        )],
    )];
    let projected = project(&mut result);
    assert_eq!(projected["status/default"], (true, vec!["badge".into()]));
    // The parent's own views hold no Badge, so its own detail names nothing.
    assert_eq!(projected["status"], (false, vec![]));
}

#[test]
fn parent_evidence_names_the_changed_component_in_the_parents_detail() {
    let mut result = status_family();
    result.review.affected = vec![affected(
        "status",
        ConsumerKind::Component,
        vec![evidence(
            ReviewSide::After,
            ConsumerKind::Component,
            "status",
        )],
    )];
    let projected = project(&mut result);
    assert_eq!(projected["status"], (true, vec!["badge".into()]));
    assert_eq!(projected["status/default"], (false, vec![]));
}

#[test]
fn moved_consumers_name_the_changed_component_in_their_current_details() {
    let before = vec![
        entry("badge", EntryKind::Component, None),
        entry("old/receipt", EntryKind::Screen, None),
        entry("old/status", EntryKind::Component, None),
        entry(
            "old/status/default",
            EntryKind::Component,
            Some("old/status"),
        ),
    ];
    let after = vec![
        entry("badge", EntryKind::Component, None),
        entry("new/receipt", EntryKind::Screen, None),
        entry("new/status", EntryKind::Component, None),
        entry(
            "new/status/default",
            EntryKind::Component,
            Some("new/status"),
        ),
    ];
    let moves = [
        (EntryKind::Screen, "receipt"),
        (EntryKind::Component, "status"),
        (EntryKind::Component, "status/default"),
    ];
    let mut result = paired_result(
        before,
        after,
        vec![
            classified("badge", EntryKind::Component, ReviewState::Changed),
            moved("new/receipt", "old/receipt", EntryKind::Screen),
            moved("new/status", "old/status", EntryKind::Component),
            moved(
                "new/status/default",
                "old/status/default",
                EntryKind::Component,
            ),
        ],
        Pairing {
            entries: (0..4)
                .map(|index| EntryPair {
                    before: Some(index),
                    after: Some(index),
                    moved: index > 0,
                })
                .collect(),
            moves: moves
                .into_iter()
                .map(|(kind, path)| MovePair {
                    kind,
                    path: format!("new/{path}"),
                    previous_path: format!("old/{path}"),
                })
                .collect(),
            diagnostics: vec![],
        },
    );
    result.review.affected = vec![
        affected(
            "new/status",
            ConsumerKind::Component,
            vec![evidence(
                ReviewSide::Before,
                ConsumerKind::Component,
                "old/status/default",
            )],
        ),
        affected(
            "new/receipt",
            ConsumerKind::Screen,
            vec![
                evidence(ReviewSide::Before, ConsumerKind::Screen, "old/receipt"),
                evidence(ReviewSide::After, ConsumerKind::Screen, "new/receipt"),
            ],
        ),
    ];
    let projected = project(&mut result);
    assert_eq!(projected["new/receipt"], (true, vec!["badge".into()]));
    assert_eq!(
        projected["new/status/default"],
        (true, vec!["badge".into()])
    );
    assert_eq!(projected["new/status"], (false, vec![]));
}
