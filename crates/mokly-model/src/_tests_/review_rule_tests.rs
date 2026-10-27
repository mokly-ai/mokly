//! Rule evidence records: the page-owned, component-owned, and unresolved
//! records that review validation admits, and the records it rejects.

use serde_json::{Value, json};

use crate::readers::review;

const STYLESHEET: &str = "static/shared.css";

/// A material screen change whose mobile view keeps two page-owned rules of a
/// changed stylesheet, and whose desktop view keeps only its excluded record.
fn fixture() -> Value {
    let address = json!({"path": "auth", "title": "Sign in", "props": {}});
    json!({
        "schemaVersion": 8,
        "baseCommit": "a".repeat(40),
        "entries": [{
            "kind": "screen",
            "path": "auth",
            "title": "Sign in",
            "before": address,
            "after": address,
            "state": "changed",
            "included": true,
            "reasons": [{"kind": "dependency", "path": STYLESHEET}, {"kind": "material"}],
            "views": [
                {
                    "viewport": "mobile",
                    "colorScheme": "light",
                    "state": "changed",
                    "ignoredIds": [],
                    "rules": [record(".auth", "matched", entry()), record(".button", "matched", entry())],
                },
                {
                    "viewport": "desktop",
                    "colorScheme": "light",
                    "state": "unchanged",
                    "ignoredIds": [],
                    "rules": [record("", "excluded", entry())],
                },
            ],
        }],
        "affected": [],
        "diagnostics": [],
    })
}

fn entry() -> Value {
    json!({"kind": "entry"})
}

fn component() -> Value {
    json!({"kind": "component", "path": "button"})
}

fn record(selector: &str, status: &str, owner: Value) -> Value {
    sheet(STYLESHEET, selector, status, owner)
}

fn sheet(stylesheet: &str, selector: &str, status: &str, owner: Value) -> Value {
    json!({"stylesheet": stylesheet, "selector": selector, "status": status, "owner": owner})
}

/// The fixture with its mobile view's rules replaced.
fn with_rules(rules: Value) -> Value {
    let mut value = fixture();
    value["entries"][0]["views"][0]["rules"] = rules;
    value
}

fn accepted(value: &Value) -> bool {
    review(&value.to_string()).is_ok()
}

#[test]
fn rule_evidence_admits_page_owned_component_owned_and_unresolved_records() {
    assert!(accepted(&fixture()));
    assert!(accepted(&with_rules(json!([
        record("", "unresolved", entry()),
        record(".auth", "matched", component()),
        record(".auth", "matched", entry()),
    ]))));
}

#[test]
fn rule_evidence_rejects_malformed_and_contradictory_records() {
    let mut extra = record(".auth", "matched", entry());
    extra["ruleKey"] = json!("a".repeat(64));
    let cases = [
        ("an empty rule list", json!([])),
        ("a null rule list", Value::Null),
        (
            "a private source path",
            json!([sheet("mockups/shared.css", ".auth", "matched", entry())]),
        ),
        (
            "a dot segment",
            json!([sheet("static/../shared.css", ".auth", "matched", entry())]),
        ),
        (
            "a query",
            json!([sheet("static/shared.css?v=1", ".auth", "matched", entry())]),
        ),
        (
            "an unknown status",
            json!([record(".auth", "kept", entry())]),
        ),
        (
            "an unknown owner",
            json!([record(".auth", "matched", json!({"kind": "page"}))]),
        ),
        (
            "an owner without its path",
            json!([record(".auth", "matched", json!({"kind": "component"}))]),
        ),
        (
            "an entry owner with a path",
            json!([record(
                ".auth",
                "matched",
                json!({"kind": "entry", "path": "auth"})
            )]),
        ),
        ("an extra field", json!([extra])),
        (
            "duplicate records",
            json!([
                record(".auth", "matched", entry()),
                record(".auth", "matched", entry())
            ]),
        ),
        (
            "unsorted records",
            json!([
                record(".button", "matched", entry()),
                record(".auth", "matched", entry())
            ]),
        ),
        (
            "an excluded record with a selector",
            json!([record(".auth", "excluded", entry())]),
        ),
        (
            "an excluded record owned by a component",
            json!([record("", "excluded", component())]),
        ),
        (
            "an excluded record beside a kept one",
            json!([
                record("", "excluded", entry()),
                record(".auth", "matched", entry())
            ]),
        ),
        (
            "an unresolved record owned by a component",
            json!([record("", "unresolved", component())]),
        ),
    ];
    for (name, rules) in cases {
        assert!(!accepted(&with_rules(rules)), "{name}");
    }
}

#[test]
fn an_unchanged_view_keeps_no_page_owned_kept_record() {
    let mut value = with_rules(json!([record(".auth", "matched", entry())]));
    value["entries"][0]["views"][1]["rules"] = json!([record(".auth", "matched", entry())]);
    assert!(!accepted(&value));
    value["entries"][0]["views"][1]["rules"] = json!([record(".auth", "matched", component())]);
    assert!(accepted(&value));
}

#[test]
fn a_stylesheet_reason_needs_a_kept_record_the_entry_owns() {
    assert!(!accepted(&with_rules(json!([record(
        ".auth",
        "matched",
        component()
    )]))));
    assert!(!accepted(&with_rules(json!([record(
        "",
        "excluded",
        entry()
    )]))));
}
