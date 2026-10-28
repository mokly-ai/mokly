//! Index readers enforce the viewer's own-record and per-view eligibility rules.

use serde_json::{Value, json};

use crate::readers::public_reader_tests::{empty_index, screen};
use crate::readers::{ReadError, index};

fn fixture(component: bool, removed: bool) -> Value {
    let mut value = empty_index();
    value["changesStatus"] = json!("ready");
    value["baseCommit"] = json!("b".repeat(40));
    let mut entry = screen("entry", None);
    entry["changes"] =
        json!({"status":"ready","kind":if removed {"removed"} else {"changed"},"included":true});
    for view in entry["views"].as_array_mut().unwrap() {
        view["comparison"] = json!({"status":"ready","kind":"unmodified","eligible":false});
    }
    if component {
        entry.as_object_mut().unwrap().remove("useCasePaths");
        entry["kind"] = json!("component");
        entry["slots"] = json!([]);
        entry["suppliedSlots"] = json!([]);
        entry["comparison"] = json!({"status":"ready","kind":"unmodified","eligible":false});
    }
    if removed {
        value["removedEntries"] = json!([{"entry":entry,"folderTitles":[]}]);
    } else {
        value[if component { "components" } else { "screens" }] = json!([entry]);
        value["tree"] = json!([{"kind":"entry","path":"entry"}]);
    }
    value
}

fn entry_mut(value: &mut Value, component: bool, removed: bool) -> &mut Value {
    if removed {
        &mut value["removedEntries"][0]["entry"]
    } else {
        &mut value[if component { "components" } else { "screens" }][0]
    }
}

fn reject(value: &Value, expected: &str) {
    let error = index(&value.to_string()).unwrap_err();
    let ReadError::Contract { message, .. } = error else {
        panic!("{error:?}")
    };
    assert_eq!(message.to_string(), expected);
}

#[test]
fn current_and_removed_components_require_own_eligibility_to_match_kind() {
    for removed in [false, true] {
        for kind in ["changed", "removed", "added", "unmodified"] {
            let mut value = fixture(true, removed);
            let eligible = matches!(kind, "changed" | "removed");
            entry_mut(&mut value, true, removed)["comparison"] =
                json!({"status":"ready","kind":kind,"eligible":eligible});
            assert!(index(&value.to_string()).is_ok(), "{value}");
            entry_mut(&mut value, true, removed)["comparison"]["eligible"] = json!(!eligible);
            reject(&value, "invalid component comparison eligibility");
        }
    }
}

#[test]
fn current_and_removed_views_require_eligibility_to_match_kind_and_entry_type() {
    for component in [false, true] {
        for removed in [false, true] {
            for kind in ["changed", "removed", "added", "unmodified"] {
                let mut value = fixture(component, removed);
                let eligible = kind == "changed" || (component && kind == "removed");
                entry_mut(&mut value, component, removed)["views"][0]["comparison"] =
                    json!({"status":"ready","kind":kind,"eligible":eligible});
                assert!(index(&value.to_string()).is_ok(), "{value}");
                entry_mut(&mut value, component, removed)["views"][0]["comparison"]["eligible"] =
                    json!(!eligible);
                reject(&value, "invalid comparison eligibility");
            }
        }
    }
}
