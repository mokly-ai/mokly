//! Raw Plan encoding values are lenient at the JSON boundary.

use bytes::Bytes;

use crate::http::{Body, Encoding, Response};
use crate::plan::Plan;
use crate::settings::Settings;

use super::support::response;

fn plan_body(encodings: &str) -> Response {
    let body = format!(
        r#"{{"schemaVersion":1,"upload":{{"id":"upload-1","expiresAt":"2030-09-26T13:00:00.000Z"}},"missing":[],"blobUrl":"https://api.example.com/blobs/{{sha256}}","completeUrl":"https://api.example.com/complete","blobEncodings":{encodings}}}"#
    );
    Response {
        body: Body::Bytes(Bytes::from(body)),
        ..response(200)
    }
}

fn parse(encodings: &str) -> Result<Plan, crate::error::Error> {
    let settings = Settings::new("https://api.example.com/plan", "secret".to_owned(), 1).unwrap();
    Plan::parse(&plan_body(encodings), &settings, &Default::default())
}

#[test]
fn invalid_string_item_does_not_hide_a_later_gzip_offer() {
    let plan = parse(r#"["\ud800","gzip"]"#).unwrap();
    assert_eq!(plan.blob_encoding, Encoding::Gzip);
}

#[test]
fn invalid_scalar_encoding_value_counts_as_absent() {
    let plan = parse(r#""\ud800""#).unwrap();
    assert_eq!(plan.blob_encoding, Encoding::Identity);
}

#[test]
fn non_finite_number_item_does_not_hide_a_later_gzip_offer() {
    let plan = parse(r#"[1e400,"gzip"]"#).unwrap();
    assert_eq!(plan.blob_encoding, Encoding::Gzip);
}

#[test]
fn deeply_nested_item_does_not_hide_a_later_gzip_offer() {
    let nested = format!("{}\"ignored\"{}", "[".repeat(128), "]".repeat(128));
    let value = format!("[{nested},\"gzip\"]");
    let plan = parse(&value).unwrap();
    assert_eq!(plan.blob_encoding, Encoding::Gzip);
}

#[test]
fn punctuation_inside_a_nested_item_does_not_split_the_list() {
    let plan = parse(r#"[{"a":[1,"]"]},"gzip"]"#).unwrap();
    assert_eq!(plan.blob_encoding, Encoding::Gzip);
}
