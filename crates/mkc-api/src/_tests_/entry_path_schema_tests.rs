//! One shared OpenAPI path schema stays aligned with server selection validation.

#![allow(clippy::unwrap_used, clippy::panic)]

use mkc_publications::screens::shareable_identity;
use regex::Regex;
use serde_json::Value;
use utoipa::OpenApi;

use crate::contract::document::ApiDoc;

fn document() -> Value {
    serde_json::to_value(ApiDoc::openapi()).unwrap()
}

#[test]
fn all_entry_path_fields_reference_one_bounded_schema() {
    let document = document();
    let schemas = &document["components"]["schemas"];
    let schema = &schemas["EntryPath"];
    assert_eq!(schema["type"], "string");
    assert_eq!(schema["minLength"], 1);
    assert_eq!(schema["maxLength"], 2048);
    assert_eq!(schema["pattern"], "^[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*$");
    for field in [
        &schemas["Screen"]["properties"]["path"],
        &schemas["Anchor"]["properties"]["screenPath"],
    ] {
        assert_eq!(field["$ref"], "#/components/schemas/EntryPath");
        assert!(field.get("pattern").is_none());
        assert!(field.get("maxLength").is_none());
    }
    for (path, field) in [
        (
            "/v1/projects/{projectId}/publications/{publicationId}/share",
            "catalogueScreen",
        ),
        (
            "/v1/projects/{projectId}/publications/{publicationId}/threads",
            "screenPath",
        ),
    ] {
        let parameters = document["paths"][path]["get"]["parameters"]
            .as_array()
            .unwrap();
        let parameter = parameters.iter().find(|p| p["name"] == field).unwrap();
        assert_eq!(
            parameter["schema"]["$ref"],
            "#/components/schemas/EntryPath"
        );
        assert!(!parameters.iter().any(|p| p["name"] == "screen"));
    }
}

#[test]
fn the_pattern_and_server_differ_only_on_documented_portability_checks() {
    let document = document();
    let schemas = &document["components"]["schemas"];
    let schema = &schemas["EntryPath"];
    let pattern = Regex::new(schema["pattern"].as_str().unwrap()).unwrap();
    let min = schema["minLength"].as_u64().unwrap() as usize;
    let max = schema["maxLength"].as_u64().unwrap() as usize;
    let mut inputs = vec![
        "".to_owned(),
        "a".into(),
        "Product/Screen_1".into(),
        "a/mokly-generated".into(),
        "node_modules/_Screen".into(),
        "com10/lpt0".into(),
        "/a".into(),
        "a/".into(),
        "a//b".into(),
        "a.b".into(),
        "a b".into(),
        "a%2fb".into(),
        "a\\b".into(),
        "a\n".into(),
        "é".into(),
        "a".repeat(2048),
        "a".repeat(2049),
    ];
    let devices: Vec<_> = ["aux", "con", "nul", "prn"]
        .into_iter()
        .map(str::to_owned)
        .chain((1..=9).flat_map(|i| [format!("com{i}"), format!("lpt{i}")]))
        .collect();
    let mut exceptions: Vec<_> = devices
        .iter()
        .flat_map(|name| [name.clone(), format!("a/{}", name.to_uppercase())])
        .collect();
    exceptions.extend(["mokly-generated".into(), "MOKLY-GENERATED/a".into()]);
    inputs.extend(exceptions.clone());
    for path in inputs {
        let declared = (min..=max).contains(&path.chars().count()) && pattern.is_match(&path);
        let server = shareable_identity(&path);
        if exceptions.contains(&path) {
            assert!(declared && !server, "{path}");
        } else {
            assert_eq!(declared, server, "{path:?}");
        }
    }
}
