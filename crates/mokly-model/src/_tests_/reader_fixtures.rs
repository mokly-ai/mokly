//! Owned index and detail examples with every public nested record kind.

use serde_json::{Value, json};

pub(super) fn index() -> Value {
    let mut value: Value =
        serde_json::from_str(include_str!("fixtures/catalogue-v9.json")).unwrap();
    value["live"] = json!({"generation":"f6".repeat(32)});
    let action = &mut value["components"][0];
    action["propSchema"] = json!({"type":"object","additionalProperties":false,
        "required":["label"],"properties":{"label":{"type":"string","title":"Label"},
        "disabled":{"type":"boolean"},"count":{"type":"integer","minimum":0,"maximum":10,"multipleOf":2},
        "tone":{"oneOf":[{"const":"calm","title":"Calm"},{"const":"loud"}]}}});
    action["controls"] = json!({"label":{"kind":"text","label":"Label","maxLength":20},
        "disabled":{"kind":"boolean","description":"Turn the action off"},
        "count":{"kind":"number","minimum":0,"maximum":10,"step":2},
        "tone":{"kind":"select","options":[{"label":"Calm","value":"calm"},{"label":"loud","value":"loud"}]}});
    value
}

pub(super) fn usage() -> Value {
    let instance = "a1".repeat(32);
    json!({"status":"ready","instances":[{"key":instance,"id":"action",
        "componentId":"components/action","owner":{"kind":"entry"},"order":0,
        "props":{"label":["string","Go"]},"propsKey":"b2".repeat(32),
        "source":{"path":"specs/product/browse/home.html","line":3,"column":5}}],
        "slots":[{"key":"c3".repeat(32),"instanceKey":instance,"name":"icon",
            "owner":{"kind":"instance","instanceKey":instance},"sourceSlotKey":"d4".repeat(32)}],
        "ranges":[{"id":"r-0","target":{"kind":"instance","instanceKey":instance}},
            {"id":"r-1","target":{"kind":"slot","slotKey":"c3".repeat(32)},"parentId":"r-0"}]})
}

pub(super) fn details() -> Vec<Value> {
    let mut value: Value =
        serde_json::from_str(include_str!("fixtures/entry-details-v4.json")).unwrap();
    let home = &mut value["current"]["product/browse/home"];
    for view in home["views"].as_array_mut().unwrap() {
        view["usage"] = usage();
        view["resourceEvidence"] = json!({"rules":[{"stylesheet":"styles/action.css",
            "selector":".action","status":"matched","owner":{"kind":"component","path":"components/action"}}],
            "resources":[{"path":"assets/icon.svg","owner":{"kind":"entry"}}]});
    }
    home["reasons"] = json!([{"kind":"dependency","path":"styles/action.css"},{"kind":"material"}]);
    home["workspace"]["relatedComponents"] = json!([{"path":"components/action","title":"Action"}]);
    home["workspace"]["inputChanges"] = json!([{"instanceId":"action","title":"Action",
        "viewport":"mobile","colorScheme":"light","variantPath":"components/action/default",
        "before":{"label":["string","Go"]},"after":{"label":["string","Continue"]}}]);
    let action = &mut value["current"]["components/action"];
    let link = json!({"entryPath":"product/browse/home","entryKind":"screen","title":"Home",
        "viewport":"mobile","colorScheme":"light","instanceKey":"a1".repeat(32),
        "direct":true,"removed":false,"comparisonEligible":true});
    action["workspace"]["usedBy"] = json!([link]);
    action["workspace"]["affected"] = json!([link]);
    ["current", "removed"]
        .into_iter()
        .flat_map(|kind| value[kind].as_object().unwrap().values().cloned())
        .collect()
}

pub(super) fn detail(path: &str) -> Value {
    details()
        .into_iter()
        .find(|value| value["entry"]["path"] == path)
        .unwrap()
}

pub(super) fn extend(value: &mut Value) {
    match value {
        Value::Array(items) => items.iter_mut().for_each(extend),
        Value::Object(record) => {
            for (key, child) in record.iter_mut() {
                if matches!(key.as_str(), "props" | "propSchema" | "before" | "after") {
                    continue;
                }
                if key == "controls" {
                    for control in child.as_object_mut().unwrap().values_mut() {
                        extend(control);
                    }
                } else {
                    extend(child);
                }
            }
            record.insert("later".into(), json!(1));
        }
        _ => {}
    }
}
