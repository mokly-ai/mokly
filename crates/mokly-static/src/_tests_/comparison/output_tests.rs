//! Immutable generation inventory and defensive historical failures.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_compare::projection_index;
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use mokly_model::catalogue::EntryContent;
use mokly_model::material::digest;
use mokly_model::projection;
use unimock::{MockFn, Unimock, matching};

use crate::comparison_output;
use crate::error::Error;
use crate::inventory::Inventory;
use crate::transaction::CancellationMock;

use super::support::{artifact, catalogue, generation, plans, result, result_with};

#[test]
fn a_small_generation_has_stable_files_and_no_public_private_snapshot() {
    let result = result();
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
    assert_eq!(index.removed_entries.len(), 1);
    assert!(
        index
            .comparison_url
            .as_ref()
            .unwrap()
            .ends_with("/review.json")
    );
    let files = inventory.into_files();
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
