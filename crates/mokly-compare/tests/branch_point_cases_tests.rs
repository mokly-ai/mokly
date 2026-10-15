//! Shared data fixtures are suitable for Rust, Serve, build, and later browser verification.

use std::collections::BTreeMap;

use mokly_compare::lookup::{Destination, Lookup, Parent};
use mokly_model::axes::EntryKind;
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

#[test]
fn shared_real_git_cases_preserve_side_paths_destinations_and_parent_titles() {
    let cases: Vec<Case> = serde_json::from_str(include_str!(
        "../../../tests/fixtures/branch_point_cases.json"
    ))
    .unwrap();
    for case in cases {
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
            if case.name == "parent-move-removed-variant" {
                assert!(
                    matches!(parent, Some(Parent::Entry(Destination::Current(entry))) if entry.metadata.path == "new-card" && entry.metadata.title == "Current Card")
                );
            }
            if case.name == "case-only-identities" {
                assert!(
                    matches!(parent, Some(Parent::Entry(Destination::Current(entry))) if entry.metadata.path == "card")
                );
            }
            if case.name == "kind-reuse-parent-title" {
                assert!(matches!(parent, Some(Parent::Title("Historical Card"))));
            }
        }
        if case.name == "variant-between-parents" {
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

        if case.name == "case-only-identities" {
            assert_eq!(
                lookup
                    .counterpart("generation", EntryKind::Component, "card/large")
                    .unwrap(),
                Some("Card/Large")
            );
            assert_eq!(
                lookup
                    .previous("generation", EntryKind::Screen, "home")
                    .unwrap(),
                None
            );
        }
        assert!(
            lookup
                .reference("superseded", ReviewSide::Before, EntryKind::Screen, "home")
                .is_err()
        );
    }
}
