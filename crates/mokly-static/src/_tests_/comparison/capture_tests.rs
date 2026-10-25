//! Cancellation fences precede every document and resource read.

use std::collections::{BTreeMap, BTreeSet};

use mokly_graph::closure::GeneratedResourcesMock;
use mokly_graph::types::RenderGenerationMock;
use mokly_model::review_affected::ReviewSide;
use unimock::{MockFn, Unimock, matching};

use crate::comparison_files;
use crate::error::Error;
use crate::inventory::Inventory;
use crate::transaction::CancellationMock;

use super::support::plans;

#[test]
fn cancellation_precedes_document_generated_resource_and_authored_resource_reads() {
    for phase in 0..3 {
        let graph = match phase {
            0 => Unimock::new(
                RenderGenerationMock::plans
                    .next_call(matching!())
                    .returns(plans("home", 0)),
            ),
            1 => Unimock::new((
                RenderGenerationMock::plans
                    .next_call(matching!())
                    .returns(BTreeMap::new()),
                RenderGenerationMock::resource_routes
                    .next_call(matching!())
                    .returns(vec!["styles.css".into()]),
            )),
            _ => Unimock::new((
                RenderGenerationMock::plans
                    .next_call(matching!())
                    .returns(BTreeMap::new()),
                RenderGenerationMock::resource_routes
                    .next_call(matching!())
                    .returns(vec![]),
                RenderGenerationMock::public_files
                    .next_call(matching!())
                    .returns(BTreeSet::from(["logo.svg".into()])),
            )),
        };
        let cancellation = Unimock::new(
            CancellationMock::requested
                .next_call(matching!())
                .returns(true),
        );
        let mut inventory = Inventory::default();
        assert!(matches!(
            comparison_files::side(&graph, ReviewSide::Before, &mut inventory, &cancellation),
            Err(Error::Cancelled)
        ));
        assert!(inventory.into_files().is_empty());
    }
}

#[test]
fn absent_generated_and_authored_resources_keep_the_missing_route() {
    for authored in [false, true] {
        let graph = if authored {
            Unimock::new((
                RenderGenerationMock::plans
                    .next_call(matching!())
                    .returns(BTreeMap::new()),
                RenderGenerationMock::resource_routes
                    .next_call(matching!())
                    .returns(vec![]),
                RenderGenerationMock::public_files
                    .next_call(matching!())
                    .returns(BTreeSet::from(["logo.svg".into()])),
                RenderGenerationMock::resource_bytes
                    .next_call(matching!("static/logo.svg"))
                    .returns(Ok(None)),
            ))
        } else {
            Unimock::new((
                RenderGenerationMock::plans
                    .next_call(matching!())
                    .returns(BTreeMap::new()),
                RenderGenerationMock::resource_routes
                    .next_call(matching!())
                    .returns(vec!["styles.css".into()]),
                GeneratedResourcesMock::resource
                    .next_call(matching!("styles.css"))
                    .returns(Ok(None)),
            ))
        };
        let cancellation = Unimock::new(
            CancellationMock::requested
                .next_call(matching!())
                .returns(false),
        );
        let error = comparison_files::side(
            &graph,
            ReviewSide::After,
            &mut Inventory::default(),
            &cancellation,
        )
        .unwrap_err();
        assert!(
            matches!(error, Error::Invalid { path } if path == if authored { "static/logo.svg" } else { "styles.css" })
        );
    }
}
