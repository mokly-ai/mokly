//! Stylesheets receive the ordered source overrides of their render side.

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::config_validation::parse;
use mokly_css::resolution::SourcePackages;
use serde_json::{json, to_value};

use crate::side::inputs;

use super::resolution;

fn config(text: &str) -> ResolvedConfig {
    ResolvedConfig {
        input: parse(text, "mokly.config.json").unwrap(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        modules: Default::default(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    }
}

#[test]
fn source_package_order_for_head_contains_the_working_map() {
    let config =
        config(r#"{"moduleResolution":{"sourcePackages":{"ui":{"esm":"source"},"legacy":false}}}"#);
    let side = inputs(&config, None, 0);
    assert_eq!(
        to_value(&side.module_resolution).unwrap()["sourcePackages"],
        json!([{"ui":{"esm":"source"},"legacy":false}])
    );
    let expected: [SourcePackages; 1] = [[
        ("ui".into(), Some([("esm".into(), "source".into())].into())),
        ("legacy".into(), None),
    ]
    .into()];
    assert_eq!(resolution(&side).source_packages, expected);
}

#[test]
fn source_package_order_for_html_base_keeps_the_base_map_first() {
    let mut base = config(r#"{"moduleResolution":{"sourcePackages":{"ui":false}}}"#);
    let working = config(r#"{"moduleResolution":{"sourcePackages":{"ui":{"esm":"source"}}}}"#);
    base.modules.working_source_packages = working.source_packages().cloned();
    let side = inputs(&base, None, 0);
    let expected: [SourcePackages; 2] = [
        [("ui".into(), None)].into(),
        [("ui".into(), Some([("esm".into(), "source".into())].into()))].into(),
    ];
    assert_eq!(resolution(&side).source_packages, expected);
}
