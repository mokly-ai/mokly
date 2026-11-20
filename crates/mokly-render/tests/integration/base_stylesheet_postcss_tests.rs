//! Physical PostCSS roots stay isolated even when plain CSS can share head records.

use super::base_stylesheet_differential_tests::assert_base;
use super::base_stylesheet_support::{CSS, Fixture, generation};

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

#[test]
fn changed_tailwind_content_keeps_the_historical_utility_set() {
    let fixture = Fixture::with_files(&[
        ("mokly.config.json", CONFIG),
        (
            "postcss.mjs",
            "import tailwind from '@tailwindcss/postcss'; export default {plugins:[tailwind({base:import.meta.dirname,optimize:false})]};",
        ),
        (
            "main.css",
            "@import 'tailwindcss/utilities.css' source(none);\n@source './scanned';\n",
        ),
        ("scanned/classes.html", "<p class=\"underline\">Base</p>"),
    ]);
    fixture
        .head
        .write("scanned/classes.html", "<p class=\"italic\">Head</p>");
    let head = fixture.head.generation(fixture.head.prepare().unwrap());
    let head_css = String::from_utf8(head.resource("styles/main.css").unwrap().unwrap()).unwrap();
    assert!(head_css.contains(".italic"), "{head_css}");
    assert!(!head_css.contains(".underline"), "{head_css}");
    let (isolated, isolated_misses) = generation(&fixture.base_runtime(false), &fixture.head);
    let (shared, shared_misses) = generation(&fixture.base_runtime(true), &fixture.head);
    let base_css = String::from_utf8(shared.resource("styles/main.css").unwrap().unwrap()).unwrap();
    assert_eq!(isolated_misses, ["no-record"]);
    assert_eq!(shared_misses, ["no-record"]);
    assert!(base_css.contains(".underline"), "{base_css}");
    assert!(!base_css.contains(".italic"), "{base_css}");
    assert_eq!(
        shared.resource("styles/main.css").unwrap(),
        isolated.resource("styles/main.css").unwrap()
    );
    assert_ne!(base_css, head_css);
}

#[test]
fn even_equal_postcss_output_keeps_the_physical_root_key() {
    let fixture = Fixture::with_files(&[
        ("mokly.config.json", CONFIG),
        ("postcss.mjs", "export default {plugins:[]};"),
    ]);
    fixture.head.generation(fixture.head.prepare().unwrap());
    assert_base(&fixture, CSS, &["no-record"]);
}
