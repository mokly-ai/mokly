//! Shared scoped tracing counts real preparation work without relying on process isolation.

use std::fs;

use mokly_html::tree::{self, Node};
use mokly_model::routes;
use mokly_test_support::capture::Trace;
use tempfile::TempDir;

mod support;

#[test]
fn opaque_entries_share_routing_work_at_both_catalogue_sizes() {
    for count in [4, 16] {
        let root = TempDir::new().unwrap();
        let specs = root.path().join("specs");
        fs::create_dir(&specs).unwrap();
        fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
        fs::write(specs.join("link.component.html"),
            "---\ntitle: Link\nelement: ui-link\npropSchema: {type: object, additionalProperties: false, properties: {target: {type: string}}}\nprops: {target: page-0}\n---\n<a href=\"mock:{{target}}\">Link</a>").unwrap();
        for index in 0..count - 1 {
            fs::write(
                specs.join(format!("page-{index}.screen.html")),
                "---\ntitle: Screen\n---\n<ui-link target=\"page-0\"></ui-link>",
            )
            .unwrap();
        }
        let trace = Trace::default();
        let generation =
            trace.in_scope(|| support::prepare(root.path(), 8 * 1024 * 1024, 1).0.unwrap());
        let records = trace
            .spans()
            .iter()
            .filter(|span| span.name == "graph.prepare.routing-records")
            .count();
        assert_eq!(generation.plans().len(), count * 2);
        assert!(
            generation
                .plans()
                .values()
                .all(|plan| !plan.key.0.is_empty())
        );
        assert_eq!(
            records, 2,
            "one complete inventory and one literal component key at {count} entries"
        );
        let rendered = generation.render("page-0/index.mobile.html").unwrap();
        let document = rendered.document.as_ref().unwrap();
        let href = tree::walk(&document.tree)
            .find_map(|node| match node {
                Node::Element(element) if element.name == "a" => element.get("href"),
                _ => None,
            })
            .unwrap();
        assert_eq!(
            routes::resolve("page-0/index.mobile.html", href).as_deref(),
            Some("page-0/index.mobile.html")
        );
    }
}
