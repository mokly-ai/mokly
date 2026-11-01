//! Immutable generation inventory and defensive historical failures.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::projection_index;
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use mokly_model::canonical;
use mokly_model::catalogue::EntryContent;
use mokly_model::material::digest;
use mokly_model::output::artifact::File;
use mokly_model::projection;
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::readers;
use mokly_model::review::EntryChangeReason;
use unimock::{MockFn, Unimock, matching};

use crate::comparison_output;
use crate::error::Error;
use crate::inventory::Inventory;
use crate::transaction::CancellationMock;

use super::support::{
    artifact, catalogue, generation, generation_clauses, plans, result, result_with,
};

/// Append one generation with a removed page and return the index and its files.
fn small_generation() -> (CatalogueReadModel, Vec<File>) {
    append_generation(comparison_result())
}

fn comparison_result() -> ComparisonResult {
    let after = Unimock::new((
        generation_clauses("home", 0, true),
        RenderGenerationMock::generation_key
            .each_call(matching!())
            .returns("after"),
    ));
    result_with(generation("old", 0, true), Arc::new(after))
}

fn append_generation(result: ComparisonResult) -> (CatalogueReadModel, Vec<File>) {
    let publication = projection_index::publication("mokly.config.json".into(), "base");
    let mut index = projection::index(&result.after.catalogue().model, &[], &publication).unwrap();
    let cancellation = Unimock::new(
        CancellationMock::requested
            .each_call(matching!())
            .returns(false),
    );
    let mut inventory = Inventory::default();
    comparison_output::append(
        &result,
        &mut index,
        &mut inventory,
        b"shell",
        "mokly.config.json",
        &cancellation,
    )
    .unwrap();
    (index, inventory.into_files())
}

#[test]
fn removed_detail_keeps_id_and_bytes_when_generation_context_changes() {
    let (first_index, first_files) = append_generation(comparison_result());
    let mut changed = comparison_result();
    changed.snapshot.base_commit = "c".repeat(40);
    let (second_index, second_files) = append_generation(changed);
    assert_ne!(first_index.comparison_url, second_index.comparison_url);
    let first = first_files
        .iter()
        .find(|file| file.path.ends_with("/entries/old.json"))
        .unwrap();
    let second = second_files
        .iter()
        .find(|file| file.path.ends_with("/entries/old.json"))
        .unwrap();
    assert_eq!(first.bytes, second.bytes);
    let first_detail = readers::detail(std::str::from_utf8(&first.bytes).unwrap()).unwrap();
    let second_detail = readers::detail(std::str::from_utf8(&second.bytes).unwrap()).unwrap();
    assert_eq!(first_detail.detail_id, second_detail.detail_id);
    assert_eq!(
        first_detail.detail_id,
        canonical::detail_id(&first_detail).unwrap()
    );
}

#[test]
fn a_small_generation_has_stable_files_and_no_public_private_snapshot() {
    let (index, files) = small_generation();
    assert_eq!(index.removed_entries.len(), 1);
    let root = index.comparison_url.as_ref().unwrap();
    assert!(root.starts_with("mokly-viewer/diffs/generations/") && root.ends_with('/'));
    assert!(
        files
            .iter()
            .filter(|file| file.path.starts_with("mokly-viewer/diffs/"))
            .all(|file| file.path.starts_with(root.as_str()))
    );
    let historical = files
        .iter()
        .find(|file| file.path.ends_with("/entries/old.json"))
        .unwrap();
    let detail = readers::detail(std::str::from_utf8(&historical.bytes).unwrap()).unwrap();
    assert_eq!(detail.reasons, Some(vec![EntryChangeReason::Removed]));
    assert!(
        !files
            .iter()
            .any(|file| file.path.ends_with("/snapshot.json"))
    );
    let snapshot = files
        .iter()
        .map(|file| format!("{} {}", file.path, digest(&file.bytes)))
        .collect::<Vec<_>>()
        .join("\n");
    insta::assert_snapshot!(snapshot);
}

#[test]
fn the_generation_holds_no_review_file_and_its_removed_detail_keeps_two_space_indentation() {
    let (_, files) = small_generation();
    assert!(!files.iter().any(|file| file.path.ends_with("/review.json")));
    let text = |suffix: &str| {
        let file = files
            .iter()
            .find(|file| file.path.ends_with(suffix))
            .unwrap();
        String::from_utf8(file.bytes.to_vec()).unwrap()
    };
    let detail = text("/entries/old.json");
    assert!(detail.starts_with("{\n  \""), "{detail}");
    assert_eq!(
        detail,
        canonical::to_string(&readers::detail(&detail).unwrap()).unwrap()
    );
}

#[test]
fn historical_missing_record_missing_document_and_invalid_plan_are_typed_errors() {
    for defect in 0..3 {
        let before: Arc<dyn RenderGeneration> = match defect {
            0 => {
                let mut source = catalogue("old");
                source.model.entries[0].content = EntryContent::UseCase { steps: vec![] };
                Arc::new(Unimock::new((
                    RenderGenerationMock::catalogue
                        .each_call(matching!())
                        .returns(source),
                    RenderGenerationMock::plans
                        .each_call(matching!())
                        .returns(BTreeMap::new()),
                    RenderGenerationMock::resource_routes
                        .each_call(matching!())
                        .returns(vec![]),
                    RenderGenerationMock::public_files
                        .each_call(matching!())
                        .returns(BTreeSet::new()),
                )))
            }
            1 => Arc::new(Unimock::new((
                RenderGenerationMock::catalogue
                    .each_call(matching!())
                    .returns(catalogue("old")),
                RenderGenerationMock::plans
                    .each_call(matching!())
                    .returns(plans("old", 0)),
                RenderGenerationMock::render
                    .next_call(matching!("old/index.html"))
                    .returns(Ok(artifact(false))),
            ))),
            _ => Arc::new(Unimock::new((
                RenderGenerationMock::catalogue
                    .each_call(matching!())
                    .returns(catalogue("old")),
                RenderGenerationMock::plans
                    .each_call(matching!())
                    .returns(plans("old", 9)),
            ))),
        };
        let after: Arc<dyn RenderGeneration> = if defect == 0 {
            generation("home", 0, true)
        } else {
            Arc::new(Unimock::new(
                RenderGenerationMock::catalogue
                    .each_call(matching!())
                    .returns(catalogue("home")),
            ))
        };
        let result = result_with(before, after);
        let publication = projection_index::publication("mokly.config.json".into(), "base");
        let mut index =
            projection::index(&result.after.catalogue().model, &[], &publication).unwrap();
        let cancellation = if defect == 0 {
            Unimock::new(
                CancellationMock::requested
                    .next_call(matching!())
                    .returns(false)
                    .once(),
            )
        } else {
            Unimock::new(())
        };
        let error = comparison_output::append(
            &result,
            &mut index,
            &mut Inventory::default(),
            b"shell",
            "mokly.config.json",
            &cancellation,
        )
        .unwrap_err();
        assert!(match defect {
            0 => matches!(error, Error::Invalid { path } if path == "old"),
            1 => matches!(error, Error::Invalid { path } if path == "old/index.html"),
            _ => matches!(error, Error::PlanEntry { entry: 9, .. }),
        });
    }
}

#[test]
fn cancellation_after_both_sides_stops_before_removed_records_are_published() {
    let result = result();
    let publication = projection_index::publication("mokly.config.json".into(), "base");
    let mut index = projection::index(&result.after.catalogue().model, &[], &publication).unwrap();
    let cancellation = Unimock::new((
        CancellationMock::requested
            .next_call(matching!())
            .returns(false)
            .n_times(2),
        CancellationMock::requested
            .next_call(matching!())
            .returns(true),
    ));
    let mut inventory = Inventory::default();
    assert!(matches!(
        comparison_output::append(
            &result,
            &mut index,
            &mut inventory,
            b"shell",
            "mokly.config.json",
            &cancellation
        ),
        Err(Error::Cancelled)
    ));
    assert!(inventory.into_files().is_empty());
    assert!(index.removed_entries.is_empty());
    assert!(index.comparison_url.is_none());
}
