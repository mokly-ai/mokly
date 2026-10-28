//! Unknown ignore-wrapper attributes never reach a document key.

use std::fs;
use std::path::Path;
use std::sync::Arc;

use mokly_graph::types::RenderGeneration;
use tempfile::TempDir;

mod support;

const OTHER: &str = "specs/other.screen.html";

fn write(root: &Path, path: &str, source: &str) {
    let file = root.join(path);
    fs::create_dir_all(file.parent().unwrap()).unwrap();
    fs::write(file, source).unwrap();
}

fn fixture(home: &str) -> TempDir {
    let root = TempDir::new().unwrap();
    write(
        root.path(),
        "mokly.config.json",
        r#"{"colorSchemes":["light","dark"]}"#,
    );
    write(
        root.path(),
        "specs/home.screen.html",
        &format!("---\ntitle: Home\n---\n{home}"),
    );
    write(root.path(), OTHER, "---\ntitle: Other\n---\n<h1>Other</h1>");
    write(root.path(), "assets/clock.svg", "<svg>v1</svg>");
    root
}

fn prepare(root: &Path) -> Arc<dyn RenderGeneration> {
    support::prepare(root, 8 * 1024 * 1024, 1).0.unwrap()
}

fn unchanged(root: &TempDir, entry: &str, path: &str, after: &str) {
    let routes =
        ["index.mobile.html", "index.mobile.dark.html"].map(|file| format!("{entry}/{file}"));
    let first = prepare(root.path());
    let bytes = routes
        .clone()
        .map(|route| first.render(&route).unwrap().bytes.clone());
    write(root.path(), path, after);
    let second = prepare(root.path());
    for (route, bytes) in routes.iter().zip(bytes) {
        assert_eq!(
            first.plans()[route].key,
            second.plans()[route].key,
            "{route}"
        );
        assert_eq!(bytes, second.render(route).unwrap().bytes);
    }
}

fn wrapper(attribute: &str) -> String {
    format!("<mokly-ignore id='clock' {attribute}><p>Clock</p></mokly-ignore>")
}

#[test]
fn an_unknown_wrapper_reference_is_not_a_document_input() {
    for attribute in ["href", "src"] {
        let root = fixture(&wrapper(&format!("{attribute}='../../assets/clock.svg'")));
        unchanged(&root, "home", "assets/clock.svg", "<svg>v2</svg>");
    }
}

#[test]
fn an_unknown_wrapper_link_is_not_a_routing_input() {
    for attribute in ["href='mock:other'", "to='other'", "href='{{route}}'"] {
        let root = fixture(&wrapper(attribute));
        let after = "---\ntitle: Other\ncolorSchemes: [light]\n---\n<h1>Other</h1>";
        unchanged(&root, "home", OTHER, after);
    }
}

#[test]
fn an_unknown_wrapper_link_in_a_saved_slot_is_not_a_routing_input() {
    let root = fixture("<p>Home</p>");
    write(
        root.path(),
        "specs/box.component.html",
        "---\ntitle: Box\nelement: ui-box\npropSchema: {type: object, additionalProperties: false, properties: {}}\nslots: [children]\nvariants:\n  - slug: filled\n    title: Filled\n    props: {}\n    slots: {children: \"<mokly-ignore id='slot' href='mock:other'>Slot</mokly-ignore>\"}\n---\n<section><slot></slot></section>",
    );
    let after = "---\ntitle: Other\ncolorSchemes: [light]\n---\n<h1>Other</h1>";
    unchanged(&root, "box/filled", OTHER, after);
}
