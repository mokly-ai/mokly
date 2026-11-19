//! The Vite switch accepts only the currently implemented configuration shape.

use serde_json::json;

use crate::config_validation::parse;
use crate::error::CatalogueError;

#[test]
fn vite_switch_accepts_booleans_and_an_empty_object() {
    for value in [json!(true), json!(false), json!({})] {
        let text = json!({"vite": value}).to_string();
        let config = parse(&text, "mokly.config.json");
        assert!(config.is_ok(), "{text}: {config:?}");
        assert_eq!(
            serde_json::to_value(config.unwrap().vite.unwrap()).unwrap(),
            value
        );
    }
}

#[test]
fn vite_config_path_is_an_unknown_field_until_optional_setup_exists() {
    let error = parse(
        r#"{"vite":{"config":"mokly.vite.ts"}}"#,
        "mokly.config.json",
    )
    .unwrap_err();
    let CatalogueError::Config(issue) = error else {
        panic!("expected a configuration error")
    };
    assert_eq!(issue.message, "unknown configuration field: config");
}

#[test]
fn disabled_vite_preserves_existing_configuration_key_bytes() {
    let original = r#"{"$schema":null,"roots":null,"repoRoot":null,"colorSchemes":["light"],"renderer":null,"postcss":null,"moduleResolution":null,"stylesheets":null,"review":null,"watch":null}"#;
    for text in ["{}", r#"{"vite":false}"#] {
        let config = parse(text, "mokly.config.json").unwrap();
        assert_eq!(serde_json::to_string(&config).unwrap(), original);
    }
}
