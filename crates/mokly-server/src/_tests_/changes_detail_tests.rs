//! Serve delivers reasons without a workspace and removes them with stale evidence.

use std::sync::Arc;

use axum::body::to_bytes;
use mokly_graph::types::RenderGenerationMock;
use mokly_model::public_metadata::ChangesStatus;
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
async fn ready_reasons_are_delivered_and_every_non_ready_status_removes_them() {
    let (mut catalogue, _) = historical_inputs();
    catalogue.model = publication_support::empty_model();
    let graph = Unimock::new(
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue),
    );
    let mut comparison = accepted(Arc::new(graph.clone()), Arc::new(graph.clone()));
    let result = &mut Arc::get_mut(&mut comparison).unwrap().result;
    result.entries.truncate(1);
    result.entries[0].path = "screen-0".into();
    result.entries[0].documents.clear();
    let mut snapshot = (*publication_support::snapshot(1, Arc::new(Unimock::new(())))).clone();
    snapshot.changes = Some(comparison);
    changes_detail::apply(&mut snapshot).unwrap();
    let ready = delivered(&snapshot).await;
    assert_eq!(ready["reasons"], json!([{ "kind": "material" }]));
    assert!(ready.get("workspace").is_none());
    for status in [
        ChangesStatus::Preparing,
        ChangesStatus::Pending,
        ChangesStatus::Unavailable,
        ChangesStatus::Disabled,
    ] {
        let mut replacement = snapshot.clone();
        replacement.changes = None;
        replacement.index.changes_status = status;
        changes_detail::apply(&mut replacement).unwrap();
        assert!(delivered(&replacement).await.get("reasons").is_none());
    }
}
