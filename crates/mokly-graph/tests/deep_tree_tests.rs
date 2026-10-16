//! The complete native path handles deep documents on ordinary caller and worker stacks.

use std::fs;
use std::thread;

use mokly_html::{parse, serialize, tree};
use tempfile::TempDir;

mod support;

#[test]
fn one_hundred_thousand_levels_build_compose_serialize_compare_and_drop() {
    thread::spawn(|| {
        let root = TempDir::new().unwrap();
        fs::create_dir(root.path().join("specs")).unwrap();
        fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
        let body = format!(
            "{}<span id=\"deep-anchor\">{{{{ label }}}}{}</span>",
            "<span>".repeat(99_999),
            "</span>".repeat(99_999),
        );
        fs::write(
            root.path().join("specs/deep.screen.html"),
            format!("---\ntitle: Deep\nprops: {{label: deep-leaf}}\n---\n{body}"),
        )
        .unwrap();
        let (generation, cache) = support::prepare(root.path(), 0, 1);
        let generation = generation.unwrap();
        let summary = generation.render_all().unwrap();
        assert_eq!(summary.documents, 2);
        assert!(summary.warnings.is_empty());
        let first = generation.render("deep/index.mobile.html").unwrap();
        let second = generation.render("deep/index.mobile.html").unwrap();
        assert!(first.bytes == second.bytes, "uncached bytes changed");
        let first_tree = &first.document.as_ref().unwrap().tree;
        let second_tree = &second.document.as_ref().unwrap().tree;
        assert!(first_tree == second_tree, "uncached tree changed");
        assert_eq!(
            tree::walk(first_tree)
                .filter(|node| {
                    matches!(node, tree::Node::Element(element) if element.name == "span")
                })
                .count(),
            100_000
        );
        assert_eq!(cache.stats().entries, 0);
        let html = std::str::from_utf8(&first.bytes).unwrap();
        assert!(html.contains("deep-leaf"));
        let parsed = parse::document(html);
        let reparsed = parse::document(&serialize::html(&parsed));
        assert!(
            parsed == reparsed,
            "browser tree changed after serialization"
        );
        assert!(
            generation
                .closure("deep/index.mobile.html")
                .unwrap()
                .files
                .is_empty()
        );
    })
    .join()
    .unwrap();
}
