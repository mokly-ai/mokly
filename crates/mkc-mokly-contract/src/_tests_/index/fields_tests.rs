//! Missing read fields fail while unrelated index data stays producer-owned.

use serde_json::json;

use crate::error::{Error, Rejection};

use super::support::{parse, valid};

#[test]
fn every_read_field_requires_its_documented_shape() {
    for pointer in [
        "/changesStatus",
        "/comparisonUrl",
        "/screens",
        "/pages",
        "/documents",
        "/useCases",
        "/components",
        "/removedEntries",
        "/screens/0/path",
        "/screens/0/title",
        "/screens/0/changes",
        "/screens/0/views",
        "/screens/0/views/0/viewport",
        "/screens/0/views/0/colorScheme",
        "/removedEntries/0/entry",
        "/removedEntries/0/entry/path",
        "/removedEntries/0/entry/title",
        "/removedEntries/0/entry/changes",
    ] {
        let mut document = valid();
        let (parent, key) = pointer.rsplit_once('/').unwrap();
        document
            .pointer_mut(parent)
            .unwrap()
            .as_object_mut()
            .unwrap()
            .remove(key);
        assert!(
            matches!(parse(&document), Err(Error::Invalid { .. })),
            "missing {pointer}"
        );
    }
    for pointer in ["/base", "/baseCommit", "/screens/0/previousPath"] {
        let mut document = valid();
        let (parent, key) = pointer.rsplit_once('/').unwrap();
        document.pointer_mut(parent).unwrap()[key] = json!(null);
        assert!(
            matches!(parse(&document), Err(Error::Invalid { .. })),
            "null {pointer}"
        );
    }
}

#[test]
fn base_identity_and_generation_read_fields_follow_the_released_rules() {
    for (field, value) in [
        ("baseCommit", "a".repeat(39)),
        ("baseCommit", "A".repeat(40)),
        (
            "comparisonUrl",
            "https://example.invalid/generation/".to_owned(),
        ),
        (
            "comparisonUrl",
            format!("mokly-viewer/diffs/generations/{}/", "A".repeat(64)),
        ),
        (
            "comparisonUrl",
            format!("mokly-viewer/diffs/generations/{}", "a".repeat(64)),
        ),
        (
            "comparisonUrl",
            format!("mokly-viewer/diffs/generations/{}/extra/", "a".repeat(64)),
        ),
        (
            "comparisonUrl",
            format!("__mokly/diffs/__generations/{}/", "a".repeat(64)),
        ),
    ] {
        let mut document = valid();
        document[field] = json!(value);
        assert!(
            matches!(
                parse(&document),
                Err(Error::Invalid {
                    reason: Rejection::Index
                })
            ),
            "{field}: {value}"
        );
    }
    let mut document = valid();
    document.as_object_mut().unwrap().remove("baseCommit");
    assert!(matches!(
        parse(&document),
        Err(Error::Invalid {
            reason: Rejection::Index
        })
    ));
    let mut document = valid();
    document["changesStatus"] = json!("disabled");
    assert!(matches!(
        parse(&document),
        Err(Error::Invalid {
            reason: Rejection::Index
        })
    ));
    let mut document = valid();
    document["baseCommit"] = json!("a".repeat(64));
    assert_eq!(
        parse(&document).unwrap().base_commit(),
        Some("a".repeat(64).as_str())
    );
}

#[test]
fn unread_fields_do_not_add_receiver_rejections() {
    let mut document = valid();
    document["base"] = json!("");
    document["tree"] = json!(false);
    document["identity"] = json!(null);
    document["components"][0]["views"] = json!(false);
    document["removedEntries"][0]["entry"]["previousPath"] = json!("../unread");
    document["screens"][0]["title"] = json!(" \t");
    document["screens"][0]["views"] = json!([]);
    let index = parse(&document).unwrap();
    assert_eq!(index.base(), Some(""));
    assert_eq!(index.current_screens()[0].title, " \t");
    assert!(index.current_screens()[0].views.is_empty());
}
