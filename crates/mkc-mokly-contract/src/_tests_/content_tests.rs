//! Receiver content validation uses the shared lenient readers and current context.

use mokly_model::material;
use mokly_model::readers;
use mokly_model::usage::ComponentInputOwner;
use mokly_model::wire_decode;
use serde_json::{Value, json};

use crate::content::{CatalogueContent, DetailSource};
use crate::error::{Error, Rejection};
use crate::limits::Limits;

fn index() -> Value {
    serde_json::from_slice(include_bytes!("../../fixtures/catalogue-v9.json")).unwrap()
}

fn content(index: &Value) -> CatalogueContent {
    CatalogueContent::parse(&serde_json::to_vec(index).unwrap(), Limits::default()).unwrap()
}

fn details() -> Value {
    serde_json::from_slice(include_bytes!(
        "../../../../docs/protocol/fixtures/entry-details-v4.json"
    ))
    .unwrap()
}

#[test]
fn index_content_rejects_private_evidence_after_version_and_cloud_checks() {
    let mut value = index();
    value["future"] = json!({"annotation": true});
    value["screens"][0]["future"] = json!("kept by newer writers");
    let accepted = content(&value).into_index();
    assert_eq!(accepted.current_screens()[0].path, "product/browse/details");
    value["screens"][0]["future"] = json!({"usage": {"status": "pending"}});
    assert!(matches!(
        CatalogueContent::parse(&serde_json::to_vec(&value).unwrap(), Limits::default()),
        Err(Error::Invalid {
            reason: Rejection::Index
        })
    ));
    value["schemaVersion"] = json!(8);
    assert!(matches!(
        CatalogueContent::parse(&serde_json::to_vec(&value).unwrap(), Limits::default()),
        Err(Error::UnsupportedVersion {
            version: Some(8),
            ..
        })
    ));
}

#[test]
fn current_and_removed_details_use_the_lenient_reader() {
    let content = content(&index());
    let mut validator = content.details();
    for (source, side) in [
        (DetailSource::Current, "current"),
        (DetailSource::Removed, "removed"),
    ] {
        let mut detail = details()[side]
            .as_object()
            .unwrap()
            .values()
            .next()
            .unwrap()
            .clone();
        detail["future"] = json!({"display": true});
        validator
            .validate(&serde_json::to_vec(&detail).unwrap(), source)
            .unwrap();
        detail["future"]["sourceGraph"] = json!({});
        assert!(
            matches!(
                validator.validate(&serde_json::to_vec(&detail).unwrap(), source),
                Err(Error::Invalid {
                    reason: Rejection::Detail
                })
            ),
            "{source:?}"
        );
    }
}

#[test]
fn reused_current_details_are_checked_against_each_upload_index() {
    let mut index = index();
    let detail = serde_json::to_vec(&details()["current"]["components/action"]).unwrap();
    content(&index)
        .details()
        .validate(&detail, DetailSource::Current)
        .unwrap();
    index["revision"] = json!(1);
    assert!(matches!(
        content(&index)
            .details()
            .validate(&detail, DetailSource::Current),
        Err(Error::Invalid {
            reason: Rejection::Detail
        })
    ));
}

#[test]
fn unlisted_current_entries_fail_but_removed_details_need_no_current_context() {
    let mut detail = details()["current"]["components/action"].clone();
    detail["entry"]["path"] = json!("components/absent");
    assert!(matches!(
        content(&index())
            .details()
            .validate(&serde_json::to_vec(&detail).unwrap(), DetailSource::Current),
        Err(Error::Invalid {
            reason: Rejection::Detail
        })
    ));
    let removed = details()["removed"]
        .as_object()
        .unwrap()
        .values()
        .next()
        .unwrap()
        .clone();
    content(&index())
        .details()
        .validate(
            &serde_json::to_vec(&removed).unwrap(),
            DetailSource::Removed,
        )
        .unwrap();
}

#[test]
fn current_usage_is_checked_against_uploaded_component_schemas() {
    let mut detail = details()["current"]["product/browse/home"].clone();
    let props = json!({"label": ["number", "7"]});
    let key = material::instance_key(&ComponentInputOwner::Entry, None, "action");
    let props_key = material::props_key(
        &wire_decode::decode(&serde_json::from_value(props.clone()).unwrap()).unwrap(),
    );
    detail["views"][0]["usage"]["instances"] = json!([{
        "key": key, "id": "action", "componentId": "components/action",
        "owner": {"kind": "entry"}, "order": 0,
        "props": props, "propsKey": props_key
    }]);
    let bytes = serde_json::to_vec(&detail).unwrap();
    readers::detail_lenient(str::from_utf8(&bytes).unwrap()).unwrap();
    assert!(matches!(
        content(&index())
            .details()
            .validate(&bytes, DetailSource::Current),
        Err(Error::Invalid {
            reason: Rejection::Detail
        })
    ));
}
