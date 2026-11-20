//! Entry-path grammar and lowered quotas apply to every index path the cloud reads.

use serde_json::json;

use crate::error::{Error, Limit};
use crate::index::CatalogueIndex;
use crate::limits::{Limits, Quotas};

use super::support::{parse, valid};

#[test]
fn paths_allow_authored_case_underscores_and_nested_generated_names() {
    for path in [
        "Product/Screen_1",
        "a--b/-state",
        "constructor/__proto__/toString",
        "product/mokly-generated/screen",
        "product/node_modules/example",
    ] {
        let mut document = valid();
        document["screens"][0]["path"] = json!(path);
        assert_eq!(parse(&document).unwrap().current_screens()[0].path, path);
    }
}

#[test]
fn paths_refuse_every_invalid_segment_and_device_name() {
    let mut paths = [
        "",
        "/a",
        "a/",
        "a//b",
        "a/./b",
        "a.b",
        "a b",
        "a%2fb",
        "a\\b",
        "a:b",
        "é",
        "MOKLY-GENERATED/a",
    ]
    .map(String::from)
    .to_vec();
    paths.extend(["aux", "con", "nul", "prn"].map(|name| format!("product/{name}/screen")));
    for prefix in ["COM", "LPT"] {
        for number in 1..=9 {
            paths.push(format!("product/{prefix}{number}/screen"));
        }
    }
    for path in paths {
        let mut document = valid();
        document["screens"][0]["path"] = json!(path);
        assert!(
            matches!(parse(&document), Err(Error::Invalid { .. })),
            "{path}"
        );
    }
}

#[test]
fn lowered_quotas_cover_current_previous_and_removed_entry_paths() {
    for pointer in [
        "/components/0/path",
        "/documents/0/path",
        "/pages/0/path",
        "/useCases/0/path",
        "/screens/0/path",
        "/screens/0/previousPath",
        "/removedEntries/0/entry/path",
    ] {
        let mut document = valid();
        let (parent, key) = pointer.rsplit_once('/').unwrap();
        document.pointer_mut(parent).unwrap()[key] = json!("a".repeat(101));
        let result = CatalogueIndex::parse(
            &serde_json::to_vec(&document).unwrap(),
            Limits::lowered(Quotas {
                path: 100,
                ..Quotas::default()
            }),
        );
        assert!(
            matches!(result, Err(Error::TooLarge { limit: Limit::Path })),
            "{pointer}: {result:?}"
        );
    }
    for (path, limit) in [
        ("a".repeat(1025), Limit::Path),
        (vec!["a"; 65].join("/"), Limit::PathSegments),
    ] {
        let mut document = valid();
        document["screens"][0]["path"] = json!(path);
        assert!(
            matches!(parse(&document), Err(Error::TooLarge { limit: actual }) if actual == limit)
        );
    }
    for path in ["a".repeat(1024), vec!["a"; 64].join("/")] {
        let mut document = valid();
        document["screens"][0]["path"] = json!(path);
        assert_eq!(parse(&document).unwrap().current_screens()[0].path, path);
    }
    let result = CatalogueIndex::parse(
        &serde_json::to_vec(&valid()).unwrap(),
        Limits::lowered(Quotas {
            path_segments: 1,
            ..Quotas::default()
        }),
    );
    assert!(matches!(
        result,
        Err(Error::TooLarge {
            limit: Limit::PathSegments
        })
    ));
}
