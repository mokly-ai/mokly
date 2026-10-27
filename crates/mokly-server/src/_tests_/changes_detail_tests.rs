//! Serve delivers reasons and base addresses without a workspace and removes them with stale evidence.

use std::sync::Arc;

use axum::body::to_bytes;
use mokly_graph::types::RenderGenerationMock;
use mokly_model::public_metadata::{CatalogueChanges, ChangeKind, ChangesStatus};
use mokly_model::readers;
use mokly_model::usage_schemas::UsageSchemas;
use serde_json::{Value, json};
use unimock::{MockFn, Unimock, matching};

use crate::changes_detail;
use crate::comparison_support::{accepted, historical_inputs};
use crate::detail_encoding::{DetailEncoder, ValidatedDetails};
use crate::publication_support;
use crate::snapshot::Snapshot;

async fn delivered(snapshot: &Snapshot) -> Value {
    let detail = &snapshot.details["screen-0"];
    let mut schemas = UsageSchemas::new(&snapshot.index.components);
    let encoded = ValidatedDetails
        .encode(detail, &snapshot.index, &mut schemas)
        .unwrap();
    let bytes = to_bytes(
        encoded.response(snapshot.index.revision).into_body(),
        usize::MAX,
    )
    .await
    .unwrap();
    let text = std::str::from_utf8(&bytes).unwrap();
    readers::detail(text).unwrap();
    serde_json::from_str(text).unwrap()
}

#[tokio::test]
async fn withdrawing_the_classification_removes_reasons_from_delivered_bytes() {
    let (mut catalogue, _) = historical_inputs();
    catalogue.model = publication_support::empty_model();
    let graph = Unimock::new((
        RenderGenerationMock::generation_key
            .each_call(matching!())
            .returns("after"),
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue),
    ));
    let mut comparison = accepted(Arc::new(graph.clone()), Arc::new(graph.clone()));
    let result = &mut Arc::get_mut(&mut comparison).unwrap().result;
    result.entries.truncate(1);
    result.entries[0].path = "screen-0".into();
    result.entries[0].documents.clear();
    result.review.entries.truncate(1);
    let review = &mut result.review.entries[0];
    review.path = "screen-0".into();
    for side in [review.before.as_mut(), review.after.as_mut()]
        .into_iter()
        .flatten()
    {
        side.path = "screen-0".into();
    }
    let mut snapshot = (*publication_support::snapshot(1, Arc::new(Unimock::new(())))).clone();
    snapshot.index.screens[0].entry.changes = CatalogueChanges::Ready {
        kind: ChangeKind::Changed,
        included: true,
    };
    snapshot.changes = Some(comparison);
    changes_detail::apply(&mut snapshot).unwrap();
    let ready = delivered(&snapshot).await;
    assert_eq!(ready["reasons"], json!([{ "kind": "material" }]));
    assert_eq!(ready["before"]["path"], json!("screen-0"));
    assert!(ready.get("workspace").is_none());
    let mut replacement = snapshot.clone();
    replacement.changes = None;
    replacement.index.changes_status = ChangesStatus::Pending;
    replacement.index.screens[0].entry.changes = CatalogueChanges::Pending;
    changes_detail::apply(&mut replacement).unwrap();
    let withdrawn = delivered(&replacement).await;
    assert!(withdrawn.get("reasons").is_none());
    assert!(withdrawn.get("before").is_none());
}
