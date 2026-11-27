//! Configuration schema examples and semantic rules use plain in-memory data.

use mokly_model::axes::ColorScheme;
use serde_json::{Value, json};

use crate::config_validation::{CONFIG_SCHEMA, parse};
use crate::diagnostic::Code;
use crate::error::CatalogueError;

#[test]
fn schema_and_core_accept_the_configuration_examples() {
    let schema: Value = serde_json::from_str(CONFIG_SCHEMA).unwrap();
    let validator = jsonschema::validator_for(&schema).unwrap();
    for value in [
        json!({}),
        json!({"$schema":"./node_modules/@mokly/mokly/config.schema.json","roots":[{"dir":"specs"}]}),
        json!({"roots":[{"dir":"src/features","transparent":["__mockups__"]}]}),
        json!({"roots":[{"dir":"specs"},{"dir":"packages/ui/src","path":"components"}]}),
        json!({"colorSchemes":["dark","light"],"renderer":"specs/renderer.tsx","postcss":"postcss.config.mjs",
            "stylesheets":[{"match":"**","stylesheets":["theme.css","$componentStylesheets","https://example.com/fonts.css"],"darkStylesheets":["dark.css"]}],
            "moduleResolution":{"aliases":{"ui":"@app/ui","@scope/ui":"@scope/package"},"conditions":["browser"],"mainFields":["module","main"],"resolveExtensions":[".tsx",".ts"],"packageRoots":["packages/ui"],"loaders":{".css":"empty",".module.css":"empty",".svg":"text"}},
            "review":{"base":"origin/main","baseInstallScripts":true},"watch":{"debounceMs":75,"rules":[{"action":"reload","paths":["assets/**"]}]}}),
    ] {
        assert!(validator.is_valid(&value), "schema rejected {value}");
        assert!(
            parse(&value.to_string(), "mokly.config.json").is_ok(),
            "core rejected {value}"
        );
    }
}

#[test]
fn schema_and_core_reject_every_invalid_structural_setting() {
    let schema: Value = serde_json::from_str(CONFIG_SCHEMA).unwrap();
    let validator = jsonschema::validator_for(&schema).unwrap();
    for value in [
        json!({"unknown":true}),
        json!({"roots":[]}),
        json!({"roots":[{}]}),
        json!({"roots":[{"dir":"specs","unknown":true}]}),
        json!({"roots":[{"dir":"specs","files":[]}]}),
        json!({"roots":[{"dir":"specs","path":"safe/COM1/child"}]}),
        json!({"roots":[{"dir":"specs","files":["../*.md"]}]}),
        json!({"colorSchemes":[]}),
        json!({"colorSchemes":["dark"]}),
        json!({"colorSchemes":["light","light"]}),
        json!({"stylesheets":[{"match":"**","stylesheets":["$unknown"]}]}),
        json!({"stylesheets":[{"match":"**","stylesheets":["$componentStylesheets","$componentStylesheets"]}]}),
        json!({"stylesheets":[{"match":"**","stylesheets":[],"darkStylesheets":["$componentStylesheets"]}]}),
        json!({"moduleResolution":{"loaders":{".png":"css"}}}),
        json!({"moduleResolution":{"loaders":{".css":"text"}}}),
        json!({"moduleResolution":{"aliases":{"./ui":"ui"}}}),
        json!({"moduleResolution":{"aliases":{"ui":"./ui"}}}),
        json!({"moduleResolution":{"aliases":{"ui":"/absolute"}}}),
        json!({"watch":{"rules":[{"action":"invalid","paths":["a"]}]}}),
        json!({"watch":{"rules":[{"action":"reload","paths":["/absolute"]}]}}),
    ] {
        assert!(!validator.is_valid(&value), "schema accepted {value}");
        assert!(
            parse(&value.to_string(), "mokly.config.json").is_err(),
            "core accepted {value}"
        );
    }
}

#[test]
fn ordered_sets_normalize_and_cross_record_duplicates_fail() {
    let value = json!({"colorSchemes":["dark","light"],"moduleResolution":{
        "conditions":["browser","browser","default"],
        "mainFields":["module","module","main"],
        "resolveExtensions":[".tsx",".tsx",".ts"]}});
    let config = parse(&value.to_string(), "mokly.config.json").unwrap();
    assert_eq!(
        config.color_schemes.unwrap(),
        [ColorScheme::Light, ColorScheme::Dark]
    );
    let module = config.module_resolution.unwrap();
    assert_eq!(module.conditions.unwrap(), ["browser", "default"]);
    assert_eq!(module.main_fields.unwrap(), ["module", "main"]);
    assert_eq!(module.resolve_extensions.unwrap(), [".tsx", ".ts"]);
    for value in [
        json!({"roots":[{"dir":"specs"},{"dir":"specs"}]}),
        json!({"stylesheets":[{"match":"**","stylesheets":[]},{"match":"**","stylesheets":[]}]}),
        json!({"watch":{"rules":[{"action":"reload","paths":["a"]},{"action":"ignore","paths":["a"]}]}}),
        json!({"roots":[{"dir":"specs","files":["{safe,..}/**/*.md"]}]}),
    ] {
        assert!(
            parse(&value.to_string(), "mokly.config.json").is_err(),
            "{value}"
        );
    }
}

#[test]
fn unknown_nested_fields_keep_their_exact_key_location() {
    let text = "{\n  \"roots\": [{\"dir\": \"specs\", \"extra\": true}]\n}";
    let CatalogueError::Config(issue) = parse(text, "mokly.config.json").unwrap_err() else {
        panic!()
    };
    assert_eq!(issue.message, "unknown configuration field: extra");
    assert_eq!(issue.location.unwrap().line, 2);
}

#[test]
fn source_packages_normalize_build_and_source_folders_and_keep_false() {
    let value = json!({"moduleResolution":{"sourcePackages":{
        "@acme/ui":{"esm/":"./source/","./cjs":".","dist/esm":"code//ui/."},
        "legacy":false
    }}});
    let schema: Value = serde_json::from_str(CONFIG_SCHEMA).unwrap();
    assert!(jsonschema::validator_for(&schema).unwrap().is_valid(&value));
    let config = parse(&value.to_string(), "mokly.config.json").unwrap();
    assert_eq!(
        serde_json::to_value(config.module_resolution.unwrap()).unwrap()["sourcePackages"],
        json!({"@acme/ui":{"esm":"source","cjs":".","dist/esm":"code/ui"},"legacy":false})
    );
}

#[test]
fn source_packages_accept_names_with_npm_punctuation() {
    let packages = json!({
        "@acme/-theme": false,
        "@acme~/ui": {"esm": "source"},
        "theme(": false,
    });
    let value = json!({"moduleResolution":{"sourcePackages":packages}});
    let parsed = parse(&value.to_string(), "mokly.config.json")
        .map(|config| {
            serde_json::to_value(config.module_resolution).unwrap()["sourcePackages"].clone()
        })
        .map_err(|error| error.to_string());
    assert_eq!(parsed, Ok(packages));
}

#[test]
fn source_packages_reject_invalid_entries_with_the_setting_and_config_path() {
    let schema: Value = serde_json::from_str(CONFIG_SCHEMA).unwrap();
    let validator = jsonschema::validator_for(&schema).unwrap();
    for packages in [
        json!({"./ui":false}),
        json!({"@acme/ui/button":false}),
        json!({"ui":true}),
        json!({"ui":{}}),
        json!({"ui":{"././":"source"}}),
        json!({"ui":{"":"source"}}),
        json!({"ui":{"/esm":"source"}}),
        json!({"ui":{"dist/../esm":"source"}}),
        json!({"ui":{"dist/node_modules/esm":"source"}}),
        json!({"ui":{"esm":""}}),
        json!({"ui":{"esm":"/source"}}),
        json!({"ui":{"esm":"C:/source"}}),
        json!({"ui":{"esm":"src\\ui"}}),
        json!({"ui":{"esm":"src/../ui"}}),
        json!({"ui":{"esm":"src/node_modules"}}),
    ] {
        let value = json!({"moduleResolution":{"sourcePackages":packages}});
        assert!(!validator.is_valid(&value), "schema accepted {value}");
        let issue = source_packages_issue(&value.to_string());
        assert!(
            issue.message.starts_with("moduleResolution.sourcePackages"),
            "{value}: {}",
            issue.message
        );
    }
}

#[test]
fn source_packages_reject_build_folders_with_two_spellings() {
    let text =
        r#"{"moduleResolution":{"sourcePackages":{"@acme/ui":{"esm":"source","./esm":"other"}}}}"#;
    let issue = source_packages_issue(text);
    assert!(
        issue.message.starts_with("moduleResolution.sourcePackages")
            && issue.message.contains("duplicate build folder \"esm\""),
        "{text}: {}",
        issue.message
    );
}

#[test]
fn source_packages_keep_the_last_value_of_a_repeated_build_folder() {
    let text =
        r#"{"moduleResolution":{"sourcePackages":{"@acme/ui":{"esm":"source","esm":"other"}}}}"#;
    let packages = parse(text, "mokly.config.json")
        .map(|config| {
            serde_json::to_value(config.module_resolution).unwrap()["sourcePackages"].clone()
        })
        .map_err(|error| error.to_string());
    assert_eq!(packages, Ok(json!({"@acme/ui":{"esm":"other"}})));
}

#[test]
fn repeated_color_schemes_keep_the_last_value_with_source_packages() {
    let text = r#"{"colorSchemes":["light"],"colorSchemes":["light","dark"],"moduleResolution":{"sourcePackages":{}}}"#;
    let schemes = parse(text, "mokly.config.json")
        .map(|config| config.color_schemes)
        .map_err(|error| error.to_string());
    assert_eq!(
        schemes,
        Ok(Some(vec![ColorScheme::Light, ColorScheme::Dark]))
    );
}

#[test]
fn shipped_schema_describes_source_packages_at_the_field() {
    let schema: Value = serde_json::from_str(CONFIG_SCHEMA).unwrap();
    let description = schema
        .pointer("/properties/moduleResolution/properties/sourcePackages/description")
        .and_then(Value::as_str);
    assert!(
        description.is_some_and(|text| !text.trim().is_empty()),
        "the shipped schema must expose editor help for moduleResolution.sourcePackages"
    );
}

fn source_packages_issue(text: &str) -> crate::diagnostic::Issue {
    let CatalogueError::Config(issue) = parse(text, "config/mokly.config.json").unwrap_err() else {
        panic!("expected a configuration error for {text}")
    };
    assert_eq!(issue.code, Code::ConfigInvalid, "{text}");
    assert_eq!(
        issue.location.as_ref().unwrap().path,
        "config/mokly.config.json"
    );
    issue
}
