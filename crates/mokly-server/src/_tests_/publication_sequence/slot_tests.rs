//! Canonical misses fill only their top-level id and splice the delivered revision.

use std::sync::Arc;

use axum::body::to_bytes;
use mokly_model::canonical;
use mokly_model::data::Props;
use mokly_model::review::ReviewEntryAddress;
use mokly_model::wire_props;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::detail_encoding::{DetailEncoder, DetailEncoderMock, EncodedDetails};
use crate::detail_publication::PublicationKind;
use crate::error::{InternalError, ServerError};
use crate::snapshot::SnapshotFactory;

use super::support::{generation, input, projector};

#[tokio::test]
async fn a_miss_fills_only_the_top_level_id_and_preserves_nested_identity_text() {
    let snapshot = projector().create(generation(1, 0), input(7)).unwrap();
    let mut detail = (*snapshot.details["screen-0"]).clone();
    let props: Props = serde_json::from_value(json!({
        "detailId": "0".repeat(64),
        "revision": 123,
        "nested": {"😀": [-0.0, 1e16, {"detailId": "0".repeat(64)}], "\u{e000}": {}},
        "text": "café\n\t\\\"detailId\\\":\\\"0000000000000000000000000000000000000000000000000000000000000000\\\""
    })).unwrap();
    detail.before = Some(ReviewEntryAddress {
        path: "screen-0".into(),
        title: "Before café 😀".into(),
        props: Some(wire_props::encode(&props)),
        supplied_slots: None,
    });
    let original_before = detail.before.clone();
    let original_id = detail.detail_id.clone();
    let file = EncodedDetails.encode(&mut detail).unwrap();
    assert_eq!(detail.revision, Some(7));
    assert_eq!(detail.before, original_before);
    assert_ne!(
        detail.detail_id, original_id,
        "changed content must not trust its supplied id"
    );
    assert_eq!(detail.detail_id, canonical::detail_id(&detail).unwrap());
    for revision in [0, 10, u64::MAX] {
        let body = to_bytes(file.response(revision).into_body(), usize::MAX)
            .await
            .unwrap();
        let mut expected = detail.clone();
        expected.revision = Some(revision);
        assert_eq!(
            body.as_ref(),
            canonical::to_string(&expected).unwrap().as_bytes()
        );
    }
    let mut absent = snapshot.details["screen-0"].clone();
    Arc::make_mut(&mut absent).revision = None;
    let encoder = Unimock::new(DetailEncoderMock::encode.next_call(matching!(_)).answers(
        &|_, _| {
            Err(ServerError::Internal(
                InternalError::CanonicalDetailIdentity,
            ))
        },
    ));
    let mut recent = snapshot.recent_details.clone();
    let result = recent.publish(PublicationKind::Usage, &mut absent, None, &encoder);
    assert!(
        matches!(
            result,
            Err(ServerError::Internal(
                InternalError::CanonicalDetailIdentity
            ))
        ),
        "a record with a revision must not satisfy an absent-revision detail"
    );
}
