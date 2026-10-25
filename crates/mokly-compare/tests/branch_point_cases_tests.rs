//! The shared branch-point cases through real Git commits. The browser
//! fixtures write the same cases for Serve, `build`, and the embedded viewer.
//! Rust alone also runs three more shapes that the shared cases do not hold.

use std::collections::BTreeMap;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::lookup::{Destination, Lookup, Parent};
use mokly_compare::{projection_index, projection_workspace};
use mokly_model::axes::{EntryKind, Viewport};
use mokly_model::projection;
use mokly_model::public_detail::Workspace;
use mokly_model::review::ReviewState;
use mokly_model::review_affected::ReviewSide;
use serde::Deserialize;

#[expect(
    dead_code,
    reason = "the shared fixture also exposes relocation for focused move tests"
)]
mod engine_support;

use engine_support::Fixture;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Case {
    name: String,
    base: BTreeMap<String, String>,
    head: BTreeMap<String, Option<String>>,
    moves: BTreeMap<String, String>,
    removed: BTreeMap<String, String>,
    affected: Vec<String>,
}

fn cases(source: &str) -> Vec<Case> {
    serde_json::from_str(source).unwrap()
}

fn names(cases: &[Case]) -> Vec<&str> {
    cases.iter().map(|case| case.name.as_str()).collect()
}

/// The six shared cases. Their names match the browser checks, and `check`
/// selects the extra assertions of some cases by name.
#[test]
fn shared_real_git_cases_preserve_side_paths_destinations_and_parent_titles() {
    let cases = cases(include_str!(
        "../../../tests/fixtures/branch_point_cases.json"
    ));
    assert_eq!(
        names(&cases),
        [
            "moved-consumers",
            "moved-parent",
            "moved-variant",
            "case-renames",
            "reused-parent",
            "affected-destinations"
        ]
    );
    cases.iter().for_each(check);
}

/// A moved parent with a new title, a variant that moves under a new slug,
/// and consumer moves that the detector pairs without `movedFrom`. `check`
/// selects the extra assertions of the first two by name.
#[test]
fn rust_only_shapes_keep_base_titles_new_slugs_and_detected_moves() {
    let cases = cases(include_str!("fixtures/branch_point_shapes.json"));
    assert_eq!(
        names(&cases),
        ["detected-consumers", "retitled-parent", "variant-new-slug"]
    );
    cases.iter().for_each(check);
}

fn check(case: &Case) {
    let base: Vec<_> = case
        .base
        .iter()
        .map(|(path, body)| (path.as_str(), body.as_str()))
        .collect();
    let fixture = Fixture::new(&base);
    for (path, body) in case.head.iter().filter(|(_, body)| body.is_none()) {
        assert!(body.is_none());
        fixture.remove(path);
    }
    for (path, body) in &case.head {
        if let Some(body) = body {
            fixture.edit(path, body);
        }
    }
    let result = fixture
        .compare()
        .unwrap_or_else(|error| panic!("{}: {error}", case.name));
    let moves: BTreeMap<_, _> = result
        .pairing
        .moves
        .iter()
        .map(|pair| (pair.path.clone(), pair.previous_path.clone()))
        .collect();
    assert_eq!(moves, case.moves, "{} moves", case.name);
    let removed: BTreeMap<_, _> = result
        .snapshot
        .removed_entries
        .iter()
        .map(|record| {
            (
                record.entry.metadata().path.clone(),
                record.parent_title.clone().unwrap_or_default(),
            )
        })
        .collect();
    assert_eq!(removed, case.removed, "{} removed", case.name);
    let affected: Vec<_> = result
        .review
        .affected
        .iter()
        .map(|record| record.consumer.path.clone())
        .collect();
    assert_eq!(affected, case.affected, "{} affected", case.name);
    if case.name == "affected-destinations" {
        affected_destinations(&result);
    }
    let lookup = Lookup::new(
        "generation",
        &result.after.catalogue().model,
        Some(&result.before.catalogue().model),
        &result.snapshot.removed_entries,
        &result.pairing.moves,
    )
    .unwrap();
    for pair in &result.pairing.moves {
        assert!(
            matches!(lookup.reference("generation", ReviewSide::Before, pair.kind, &pair.previous_path).unwrap(), Some(Destination::Current(entry)) if entry.metadata.path == pair.path)
        );
        assert_eq!(
            lookup
                .counterpart("generation", pair.kind, &pair.path)
                .unwrap(),
            Some(pair.previous_path.as_str())
        );
    }
    for removed in &result.snapshot.removed_entries {
        let parent = lookup
            .parent("generation", Destination::Removed(removed))
            .unwrap();
        assert!(parent.is_some());
        if case.name == "moved-parent" {
            assert!(
                matches!(parent, Some(Parent::Entry(Destination::Current(entry))) if entry.metadata.path == "branch/parent/archive/action" && entry.metadata.title == "Action")
            );
        }
        if case.name == "case-renames" {
            assert!(
                matches!(parent, Some(Parent::Entry(Destination::Current(entry))) if entry.metadata.path == "branch/case/action")
            );
        }
        if case.name == "retitled-parent" {
            assert!(
                matches!(parent, Some(Parent::Entry(Destination::Current(entry))) if entry.metadata.path == "new-card" && entry.metadata.title == "Current Card")
            );
        }
        if case.name == "reused-parent" {
            assert!(matches!(parent, Some(Parent::Title("Former action"))));
        }
    }
    if case.name == "variant-new-slug" {
        let variant = result
            .after
            .catalogue()
            .model
            .entries
            .iter()
            .find(|entry| entry.metadata.path == "receiver/arrived")
            .unwrap();
        assert!(
            matches!(lookup.parent("generation", Destination::Current(variant)).unwrap(), Some(Parent::Entry(Destination::Current(parent))) if parent.metadata.path == "receiver")
        );
    }
    if case.name == "moved-variant" {
        let variant = result
            .after
            .catalogue()
            .model
            .entries
            .iter()
            .find(|entry| entry.metadata.path == "branch/variant/receiver/primary")
            .unwrap();
        assert!(
            matches!(lookup.parent("generation", Destination::Current(variant)).unwrap(), Some(Parent::Entry(Destination::Current(parent))) if parent.metadata.path == "branch/variant/receiver")
        );
    }

    if case.name == "case-renames" {
        assert_eq!(
            lookup
                .counterpart(
                    "generation",
                    EntryKind::Component,
                    "branch/case/action/primary"
                )
                .unwrap(),
            Some("branch/case/Action/Primary")
        );
        assert_eq!(
            lookup
                .previous("generation", EntryKind::Screen, "branch/case/receipt")
                .unwrap(),
            None
        );
    }
    assert!(
        lookup
            .reference(
                "superseded",
                ReviewSide::Before,
                EntryKind::Screen,
                "branch/case/receipt"
            )
            .is_err()
    );
}

/// User decision 103 C: each Affected destination of Tally has its own detail
/// that names Tally and can compare. Meter and its variant stay out of
/// Changes, Slip is a pure move, and Ledger is in Changes while only its
/// desktop view changed.
fn affected_destinations(result: &ComparisonResult) {
    let model = &result.after.catalogue().model;
    let state = projection_index::publication("mokly.config.json".into(), "fixture-base");
    let index = projection::index(model, &[], &state).unwrap();
    let mut details = projection::pending_details(model, &index, &[]);
    for detail in details.values_mut() {
        if matches!(detail.entry.kind, EntryKind::Screen | EntryKind::Component) {
            detail.workspace = Some(Workspace {
                comparison_eligible: false,
                used_by: vec![],
                affected: vec![],
                related_components: vec![],
                input_changes: vec![],
            });
        }
    }
    projection_workspace::apply(&mut details, result).unwrap();
    for path in [
        "branch/impact/meter",
        "branch/impact/meter/default",
        "branch/impact/archive/slip",
        "branch/impact/ledger",
    ] {
        let workspace = details[path].workspace.as_ref().unwrap();
        assert!(workspace.comparison_eligible, "{path} eligible");
        assert_eq!(
            workspace
                .related_components
                .iter()
                .map(|component| component.path.as_str())
                .collect::<Vec<_>>(),
            ["branch/impact/tally"],
            "{path} related"
        );
    }
    let entry = |path: &str| {
        result
            .entries
            .iter()
            .find(|entry| entry.path == path)
            .unwrap()
    };
    for path in ["branch/impact/meter", "branch/impact/meter/default"] {
        assert!(!entry(path).included, "{path} included");
    }
    let slip = entry("branch/impact/archive/slip");
    assert!(slip.included && slip.reasons.is_empty());
    assert_eq!(slip.state, ReviewState::Unchanged);
    let ledger = entry("branch/impact/ledger");
    assert!(ledger.included);
    let states: BTreeMap<_, _> = ledger
        .documents
        .iter()
        .map(|document| (document.key.viewport, document.state))
        .collect();
    assert_eq!(states[&Some(Viewport::Mobile)], ReviewState::Unchanged);
    assert_eq!(states[&Some(Viewport::Desktop)], ReviewState::Changed);
}
