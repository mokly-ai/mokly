//! Physical PostCSS roots stay isolated even when plain CSS can share head records.

use super::base_stylesheet_differential_tests::assert_base;
use super::base_stylesheet_support::Fixture;

const CONFIG: &str = r#"{"roots":[{"dir":"specs","files":["**/*.screen.html"]}],"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["main.css"]}]}"#;

#[test]
fn changed_postcss_module_keeps_the_historical_plugin_output() {
    let fixture = Fixture::with_files(&[
        ("mokly.config.json", CONFIG),
        (
            "postcss.mjs",
            "export default {plugins:[{postcssPlugin:'fixture',Declaration(d){if(d.prop==='--selection') d.value='base';}}]};",
        ),
    ]);
    fixture.head.write("postcss.mjs", "export default {plugins:[{postcssPlugin:'fixture',Declaration(d){if(d.prop==='--selection') d.value='head';}}]};");
    let head = fixture.head.generation(fixture.head.prepare().unwrap());
    assert_eq!(
        head.resource("styles/main.css").unwrap().unwrap(),
        b".equal {\n  --selection: head;\n}\n"
    );
    assert_base(
        &fixture,
        ".equal {\n  --selection: base;\n}\n",
        &["no-record"],
    );
}
