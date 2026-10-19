//! A dedicated process isolates tracing callsites while counting real preparation work.

use std::fs;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_html::tree::{self, Node};
use mokly_model::routes;
use tempfile::TempDir;
use tracing::span::{Attributes, Id, Record};
use tracing::{Event, Metadata, Subscriber};

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
        let records = Arc::new(AtomicUsize::new(0));
        let generation = tracing::subscriber::with_default(
            RoutingWork {
                records: records.clone(),
                next: AtomicUsize::new(1),
            },
            || support::prepare(root.path(), 8 * 1024 * 1024, 1).0.unwrap(),
        );
        assert_eq!(generation.plans().len(), count * 2);
        assert!(
            generation
                .plans()
                .values()
                .all(|plan| !plan.key.0.is_empty())
        );
        assert_eq!(
            records.load(Ordering::SeqCst),
            2,
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

struct RoutingWork {
    records: Arc<AtomicUsize>,
    next: AtomicUsize,
}

impl Subscriber for RoutingWork {
    fn enabled(&self, _: &Metadata<'_>) -> bool {
        true
    }
    fn new_span(&self, attributes: &Attributes<'_>) -> Id {
        if attributes.metadata().name() == "graph.prepare.routing-records" {
            self.records.fetch_add(1, Ordering::SeqCst);
        }
        Id::from_u64(self.next.fetch_add(1, Ordering::SeqCst) as u64)
    }
    fn record(&self, _: &Id, _: &Record<'_>) {}
    fn record_follows_from(&self, _: &Id, _: &Id) {}
    fn event(&self, _: &Event<'_>) {}
    fn enter(&self, _: &Id) {}
    fn exit(&self, _: &Id) {}
}
