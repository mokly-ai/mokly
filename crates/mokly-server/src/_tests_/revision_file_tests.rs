//! Revision stamping preserves payload bytes and canonical field order.

use axum::body::to_bytes;
use serde_json::json;

use crate::revision_file::RevisionFile;
use crate::snapshot::encode;

#[tokio::test]
async fn only_the_top_level_revision_changes_and_clones_share_the_payload() {
    let original = json!({"a":{"revision":345},"revision":9,"z":r#"a \"revision\":123"#});
    let file = RevisionFile::new(encode(&original).unwrap()).unwrap();
    let shared = file.clone();
    assert_eq!(file.before.as_ptr(), shared.before.as_ptr());
    assert_eq!(file.after.as_ptr(), shared.after.as_ptr());
    for revision in [0, 10, u64::MAX] {
        let response = shared.response(revision);
        let length: usize = response.headers()["content-length"]
            .to_str()
            .unwrap()
            .parse()
            .unwrap();
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let mut expected = original.clone();
        expected["revision"] = revision.into();
        assert_eq!(body, encode(&expected).unwrap().bytes);
        assert_eq!(length, body.len());
    }
}
