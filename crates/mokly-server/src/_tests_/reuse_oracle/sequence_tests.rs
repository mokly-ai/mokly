//! Every accepted edit must publish the same bytes as the authoritative full path.

use std::sync::Arc;

use mokly_compare::comparison::Engine;
use mokly_compare::comparison_reuse::{ComparisonReuse, MemoryComparisons, ReuseFence};
use mokly_compare::comparison_types::{Comparison, ComparisonRequest};
use mokly_compare::moves::Detector;
use mokly_css::parsed_cache::MemoryParsedCss;

use super::fixture::Fixture;
use super::publication::publish;

fn engine() -> Engine {
    Engine {
        moves: Arc::new(Detector),
        css: Arc::new(MemoryParsedCss::new(1024 * 1024)),
    }
}

#[test]
fn successive_edits_publish_identical_index_details_review_and_snapshot_bytes() {
    let store = MemoryComparisons::new(8 * 1024 * 1024);
    let mut before = Fixture::default();
    let mut after = before.clone();
    let mut request = ComparisonRequest {
        base_ref: "base".into(),
        base_commit: "b".repeat(40),
        catalogue_identity: "a".repeat(64),
    };
    let mut settings = "initial";
    for (scenario, repeated_comparisons) in [
        ("initial", 0),
        ("module", 0),
        ("css-only", 0),
        ("transitive-css", 0),
        ("image", 0),
        ("ignored-resource", 0),
        ("opposite-absence", 0),
        ("opposite-presence", 0),
        ("binding-title", 0),
        ("metadata", 0),
        ("ignored-content", 0),
        ("review-ignore", 0),
        ("moved-entry", 0),
        ("cross-entry-map", 0),
        ("added-entry", 0),
        ("removed-entry", 0),
        ("base", 0),
        ("settings", 0),
        ("unknown", 8),
    ] {
        match scenario {
            "module" => {
                after
                    .html
                    .insert("one".into(), "<p>edited module</p>".into());
            }
            "css-only" => {
                after.resources.insert(
                    "static/theme.css".into(),
                    b"@import '/static/nested.css'; .card{color:blue}".to_vec(),
                );
            }
            "transitive-css" => {
                after.resources.insert(
                    "static/embedded.css".into(),
                    b".embedded{padding:9px}".to_vec(),
                );
            }
            "image" => {
                after
                    .resources
                    .insert("static/icon.png".into(), b"image two".to_vec());
            }
            "ignored-resource" => {
                after
                    .resources
                    .insert("static/ignored.png".into(), b"ignored two".to_vec());
            }
            "opposite-absence" => {
                before.resources.remove("static/nested.css");
            }
            "opposite-presence" => {
                before
                    .resources
                    .insert("static/nested.css".into(), b".card{margin:7px}".to_vec());
            }
            "binding-title" => {
                after.label = "New binding title".into();
            }
            "metadata" => {
                after.entries[0].metadata.title = "New screen title".into();
            }
            "ignored-content" => {
                after.ignored = "clock two".into();
            }
            "review-ignore" => after.remove_ignore_without_changing_bytes(),
            "moved-entry" => after.moved(),
            "cross-entry-map" => {
                after.entries[0].metadata.path = "renamed-one".into();
                after.entries[0].metadata.moved_from = Some("one".into());
                let html = after.html.remove("one").unwrap();
                after.html.insert("renamed-one".into(), html);
            }
            "added-entry" => {
                let mut entry = after.entries[0].clone();
                entry.metadata.path = "three".into();
                entry.metadata.moved_from = None;
                after.entries.push(entry);
                after
                    .html
                    .insert("three".into(), "<p>new screen</p>".into());
            }
            "removed-entry" => {
                after.entries.remove(1);
            }
            "base" => {
                before
                    .resources
                    .insert("static/icon.png".into(), b"new base image".to_vec());
                request.base_commit = "c".repeat(40);
            }
            "settings" => settings = "new settings",
            "unknown" => after.known = false,
            _ => {}
        }
        let previous = before.generation(false);
        let current = after.generation(true);
        let reused = store.begin(engine(), ReuseFence::new(&settings));
        let result = reused
            .compare_prepared(&request, previous.clone(), current.clone())
            .unwrap();
        let full = engine()
            .compare_prepared(&request, previous.clone(), current.clone())
            .unwrap();
        assert_eq!(
            publish(result),
            publish(full),
            "published bytes after {scenario}"
        );
        reused.accept();
        let repeat = store.begin(engine(), ReuseFence::new(&settings));
        let result = repeat
            .compare_prepared(&request, previous.clone(), current.clone())
            .unwrap();
        let full = engine()
            .compare_prepared(&request, previous.clone(), current.clone())
            .unwrap();
        assert_eq!(
            publish(result),
            publish(full),
            "repeat published bytes after {scenario}"
        );
        assert_eq!(
            repeat.work().compared,
            repeated_comparisons,
            "repeat comparison work after {scenario}"
        );
        repeat.accept();
    }
}
