//! Final native component roots keep the former link adaptation rejection cases.

use std::fs;

use mokly_model::usage::CatalogueUsage;
use tempfile::TempDir;

mod support;

#[test]
fn logical_links_reject_a_use_case_without_a_first_screen() {
    let root = TempDir::new().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    fs::write(
        root.path().join("specs/home.screen.html"),
        "---\ntitle: Home\n---\n<a href=\"mock:tour\">Tour</a>",
    )
    .unwrap();
    fs::write(
        root.path().join("specs/tour.use-case.yaml"),
        "title: Tour\nsteps: []\n",
    )
    .unwrap();
    let generation = support::prepare(root.path(), 1024 * 1024, 1).0.unwrap();
    let error = generation
        .render("home/index.mobile.html")
        .unwrap_err()
        .to_string();
    assert!(error.contains("home/index.mobile.html"), "{error}");
    assert!(error.contains("first screen"), "{error}");
}

#[test]
fn component_link_controls_reject_empty_text_multiple_and_unsupported_roots() {
    for body in [
        "",
        "Text",
        "<span>One</span>extra",
        "<span>One</span><span>Two</span>",
        "<p>Unsupported</p>",
        "<input>",
        "<button><input></button>",
        "<div><video controls></video></div>",
    ] {
        let root = TempDir::new().unwrap();
        fs::create_dir(root.path().join("specs")).unwrap();
        fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
        fs::write(
            root.path().join("specs/home.screen.html"),
            "---\ntitle: Home\n---\n<ui-control to=\"home\"></ui-control>",
        )
        .unwrap();
        fs::write(root.path().join("specs/control.component.html"), format!("---\ntitle: Control\nelement: ui-control\npropSchema: {{type: object, additionalProperties: false, properties: {{}}}}\n---\n{body}")).unwrap();
        let generation = support::prepare(root.path(), 1024 * 1024, 1).0.unwrap();
        let error = generation
            .render("home/index.mobile.html")
            .unwrap_err()
            .to_string();
        assert!(error.contains("MockLink child control"), "{body}: {error}");
    }
}

#[test]
fn deeply_nested_native_instances_keep_fixed_size_keys_and_equal_repeated_output() {
    let root = TempDir::new().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    fs::write(
        root.path().join("specs/home.screen.html"),
        "---\ntitle: Home\n---\n<ui-level-0></ui-level-0>",
    )
    .unwrap();
    for level in 0..34 {
        let body = if level == 33 {
            "<strong>Leaf</strong>".into()
        } else {
            format!("<ui-level-{}></ui-level-{}>", level + 1, level + 1)
        };
        fs::write(root.path().join(format!("specs/level-{level}.component.html")), format!("---\ntitle: Level {level}\nelement: ui-level-{level}\npropSchema: {{type: object, additionalProperties: false, properties: {{}}}}\n---\n{body}")).unwrap();
    }
    let generation = support::prepare(root.path(), 0, 1).0.unwrap();
    let first = generation.render("home/index.mobile.html").unwrap();
    let second = generation.render("home/index.mobile.html").unwrap();
    assert_eq!(first.bytes, second.bytes);
    let usage = &first.document.as_ref().unwrap().usage;
    assert_eq!(
        serde_json::to_value(usage).unwrap(),
        serde_json::to_value(&second.document.as_ref().unwrap().usage).unwrap()
    );
    let CatalogueUsage::Ready { instances, .. } = usage else {
        panic!("ready usage")
    };
    assert_eq!(instances.len(), 34);
    assert!(instances.iter().all(|instance| instance.key.len() == 64
        && instance.key.bytes().all(|byte| byte.is_ascii_hexdigit())));
}
