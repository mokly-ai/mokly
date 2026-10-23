//! Flattened historical records retain strict fields, identities, and decidable ordering.

use serde_json::{Value, json};

use crate::canonical;
use crate::readers::change_snapshot;

fn fixture() -> Value {
    let removed = |path: &str, id: &str| json!({"entry":{"kind":"page","path":path,"title":path,"description":"","sourcePath":format!("specs/{path}.page.html"),"relatedDocs":[]},"folderTitles":[],"snapshotId":id.repeat(64)});
    json!({"schemaVersion":4,"baseRef":"main","baseCommit":"a".repeat(40),"changedEntries":["a","b"],"movedEntries":[],"removedEntries":[removed("a","a"),removed("b","b")]})
}

#[test]
fn snapshot_reader_round_trips_and_rejects_unknown_flattened_fields_and_order() {
    let input = fixture();
    let decoded = change_snapshot(&input.to_string()).unwrap();
    let bytes = canonical::to_string(&decoded).unwrap();
    assert_eq!(
        bytes,
        canonical::to_string(&change_snapshot(&bytes).unwrap()).unwrap()
    );
    for case in ["field", "order", "parent", "identity"] {
        let mut input = fixture();
        match case {
            "field" => input["removedEntries"][0]["entry"]["extra"] = json!(true),
            "order" => input["removedEntries"].as_array_mut().unwrap().reverse(),
            "parent" => input["removedEntries"][0]["parentTitle"] = json!("Unexpected"),
            _ => input["removedEntries"][1]["snapshotId"] = json!("a".repeat(64)),
        }
        assert!(change_snapshot(&input.to_string()).is_err(), "{case}");
    }
}
