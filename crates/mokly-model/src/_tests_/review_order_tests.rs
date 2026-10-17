//! The Rust reader rejects the same three malformed orders and pairs as the viewer.

use serde_json::{Value, json};

use crate::readers::review;

fn fixture() -> Value {
    let mut value: Value = serde_json::from_str(include_str!("fixtures/review-v8.json")).unwrap();
    value["affected"] = json!([]);
    value
}

fn variant(path: &str, removed: bool) -> Value {
    let mut variant = fixture()["entries"][0].clone();
    variant.as_object_mut().unwrap().remove("variants");
    variant["path"] = json!(path);
    variant["before"]["path"] = json!(path);
    variant["after"]["path"] = json!(path);
    if removed {
        variant.as_object_mut().unwrap().remove("after");
        variant["state"] = json!("removed");
        variant["views"][0]["state"] = json!("removed");
        variant["reasons"] = json!([{ "kind":"removed" }]);
    }
    variant
}

#[test]
fn base_only_variants_cannot_precede_current_variants() {
    let mut value = fixture();
    value["entries"][0]["variants"] = json!([
        variant("card/current", false),
        variant("card/removed", true)
    ]);
    assert!(review(&value.to_string()).is_ok());
    value["entries"][0]["variants"]
        .as_array_mut()
        .unwrap()
        .reverse();
    assert!(review(&value.to_string()).is_err());
}

#[test]
fn every_moved_pair_requires_its_previous_path() {
    let mut value = fixture();
    value["entries"][0]["before"]["path"] = json!("old-card");
    value["entries"][0]["previousPath"] = json!("old-card");
    assert!(review(&value.to_string()).is_ok());
    value["entries"][0]
        .as_object_mut()
        .unwrap()
        .remove("previousPath");
    assert!(review(&value.to_string()).is_err());
}

#[test]
fn reason_targets_reject_utf8_order_and_accept_utf16_order() {
    let mut value = fixture();
    let lower_utf16 = "static/\u{10000}.png";
    let higher_utf16 = "static/\u{e000}.png";
    value["entries"][0]["reasons"] = json!([
        {"kind":"dependency","path":higher_utf16},
        {"kind":"dependency","path":lower_utf16}
    ]);
    value["entries"][0]["views"][0]["resources"] = json!([
        {"path":lower_utf16,"owner":{"kind":"entry"}},
        {"path":higher_utf16,"owner":{"kind":"entry"}}
    ]);
    assert!(review(&value.to_string()).is_err());
    value["entries"][0]["reasons"]
        .as_array_mut()
        .unwrap()
        .reverse();
    assert!(review(&value.to_string()).is_ok());
}
