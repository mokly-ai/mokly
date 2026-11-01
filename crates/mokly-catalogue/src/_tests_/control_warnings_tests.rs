//! Control-bound warnings use JSON pointers and shared JSON quoting.

use serde_json::json;

use crate::control_warnings::collect;

#[test]
fn saved_control_bound_warnings_name_the_json_pointer() {
    let entry = serde_json::from_value(json!({
        "metadata":{"path":"home","title":"Home","description":"",
            "tags":[],"relatedDocs":[],"isIndex":false,"rootIndex":0,
            "source":{"path":"home.screen.html","line":1,"column":1}},
        "content":{"kind":"screen","visual":{"colorSchemes":["light"],
            "propSchema":{"type":"object","additionalProperties":false,
                "properties":{"count":{"type":"integer"}}},
            "props":{"count":9007199254740993_u64},
            "controls":{"count":{"kind":"number","maximum":1}},
            "controlOrder":["count"]},"useCasePaths":[]}
    }))
    .unwrap();
    let warnings = collect(&[entry]);
    assert_eq!(warnings.len(), 1);
    assert_eq!(warnings[0].code, "props-control-bounds");
    assert_eq!(
        warnings[0].message,
        "saved prop \"/count\" is outside its control bounds"
    );
}
