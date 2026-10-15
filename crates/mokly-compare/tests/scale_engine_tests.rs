//! Large HTML catalogues prove operation counts and complete results without timing assertions.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_compare::error::Result;
use mokly_compare::move_types::{MoveDetector, MoveEvidence, MoveLines, MoveSignature, Pairing};
use mokly_compare::moves::Detector;
use mokly_css::parsed_cache::{MemoryParsedCss, ParsedCssCache};
use mokly_model::catalogue::CatalogueModel;
use mokly_model::review_affected::ReviewSide;

#[expect(
    dead_code,
    reason = "this scale fixture uses injected services rather than the default helper"
)]
mod engine_support;

use engine_support::Fixture;

struct CountingDetector(Arc<AtomicUsize>);
struct CountingEvidence<'a> {
    inner: &'a dyn MoveEvidence,
    count: Arc<AtomicUsize>,
}

impl MoveDetector for CountingDetector {
    fn pair(
        &self,
        before: &CatalogueModel,
        after: &CatalogueModel,
        evidence: &dyn MoveEvidence,
    ) -> Result<Pairing> {
        Detector.pair(
            before,
            after,
            &CountingEvidence {
                inner: evidence,
                count: self.0.clone(),
            },
        )
    }
}

impl MoveEvidence for CountingEvidence<'_> {
    fn signature(
        &self,
        side: ReviewSide,
        entry: usize,
        paths: &BTreeMap<String, String>,
    ) -> Result<MoveSignature> {
        self.inner.signature(side, entry, paths)
    }
    fn equal(&self, before: usize, after: usize, paths: &BTreeMap<String, String>) -> Result<bool> {
        self.count.fetch_add(1, Ordering::SeqCst);
        self.inner.equal(before, after, paths)
    }
    fn lines(
        &self,
        before: usize,
        after: usize,
        paths: &BTreeMap<String, String>,
    ) -> Result<Option<MoveLines>> {
        self.inner.lines(before, after, paths)
    }
}

fn files(size: usize) -> Vec<(String, String)> {
    (0..size).map(|index| (format!("specs/old-{index:04}.component.html"), format!("---\ntitle: Parent\nelement: ui-parent-{index}\npropSchema: {{type: object, additionalProperties: false, required: [label], properties: {{label: {{type: string}}}}}}\nprops: {{label: Own}}\nvariants: [{{slug: unique, title: Unique, props: {{label: Unique-{index}}}}}]\n---\n<p class=\"shared\">{{{{label}}}}</p>"))).collect()
}

#[test]
fn unique_variant_material_keeps_actual_parent_full_comparisons_linear() {
    let count = |size| {
        let files = files(size);
        let borrowed: Vec<_> = files
            .iter()
            .map(|(path, body)| (path.as_str(), body.as_str()))
            .collect();
        let fixture = Fixture::new(&borrowed);
        for (path, _) in &files {
            fixture.relocate(path, &path.replace("old-", "new-"));
        }
        let calls = Arc::new(AtomicUsize::new(0));
        let result = fixture
            .compare_with(
                Arc::new(CountingDetector(calls.clone())),
                Arc::new(MemoryParsedCss::new(65536)),
            )
            .unwrap();
        assert_eq!(result.counts.moved, 2 * size);
        assert_eq!(result.counts.changes, 2 * size);
        assert!(result.snapshot.removed_entries.is_empty());
        assert!(result.entries.iter().all(|entry| entry.reasons.is_empty()));
        calls.load(Ordering::SeqCst)
    };
    let smaller = count(128);
    let larger = count(512);
    assert!(smaller > 0);
    assert_eq!(smaller, 128);
    assert!(larger * 2 <= smaller * 9);
}

#[test]
fn one_changed_stylesheet_parses_once_per_content_across_all_saved_views() {
    let count = |size| {
        let mut files = files(size);
        files.push((
            "mokly.config.json".into(),
            "{\"stylesheets\":[{\"match\":\"**\",\"stylesheets\":[\"style.css\"]}]}".into(),
        ));
        files.push(("style.css".into(), ".shared{color:red}".into()));
        let borrowed: Vec<_> = files
            .iter()
            .map(|(path, body)| (path.as_str(), body.as_str()))
            .collect();
        let fixture = Fixture::new(&borrowed);
        fixture.edit("style.css", ".shared{color:blue}");
        let cache: Arc<dyn ParsedCssCache> = Arc::new(MemoryParsedCss::new(65536));
        let result = fixture
            .compare_with(Arc::new(Detector), cache.clone())
            .unwrap();
        assert_eq!(result.counts.changes, 2 * size);
        assert!(result.entries.iter().all(|entry| entry.included));
        assert!(result.review.affected.is_empty());
        assert!(cache.stats().bytes <= 65536);
        (cache.stats(), result.resource_work)
    };
    let smaller = count(16);
    let larger = count(64);
    assert_eq!(smaller.0.parses, 2);
    assert_eq!(larger.0.parses, smaller.0.parses);
    assert_eq!(smaller.1.diffs, 1);
    assert_eq!(larger.1.diffs, smaller.1.diffs);
    assert!(smaller.1.reads > 0);
    assert_eq!(larger.1.reads, smaller.1.reads);
}

#[test]
fn distinct_ignore_ids_use_bounded_full_comparisons_for_unique_author_content() {
    let run = |size| {
        let files: Vec<_> = (0..size).map(|index| (format!("specs/old-{index}.screen.html"), format!("---\ntitle: Entry\n---\n<mokly-ignore id=\"left-{index}\">Unique {index}</mokly-ignore>"))).collect();
        let fixture = Fixture::new(
            &files
                .iter()
                .map(|(path, body)| (path.as_str(), body.as_str()))
                .collect::<Vec<_>>(),
        );
        for (index, (path, body)) in files.iter().enumerate() {
            fixture.remove(path);
            fixture.edit(
                &format!("specs/new-{index}.screen.html"),
                &body.replace("left-", "right-"),
            );
        }
        let calls = Arc::new(AtomicUsize::new(0));
        let result = fixture
            .compare_with(
                Arc::new(CountingDetector(calls.clone())),
                Arc::new(MemoryParsedCss::new(4096)),
            )
            .unwrap();
        assert_eq!(result.counts.moved, size);
        calls.load(Ordering::SeqCst)
    };
    let small = run(8);
    let large = run(32);
    assert_eq!(small, 8);
    assert!(large * 2 <= small * 9);
}

#[test]
fn widely_used_changed_components_and_shared_resources_use_indexed_work() {
    let run = |size| {
        let mut files: Vec<_> = (0..size)
            .map(|index| {
                (
                    format!("specs/home-{index}.screen.html"),
                    "---\ntitle: Home\n---\n<ui-card></ui-card>".to_owned(),
                )
            })
            .collect();
        files.push(("specs/card.component.html".into(), "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<p>Card</p><img src=\"../../image.svg\">".into()));
        files.push(("image.svg".into(), "before".repeat(1024)));
        let fixture = Fixture::new(
            &files
                .iter()
                .map(|(path, body)| (path.as_str(), body.as_str()))
                .collect::<Vec<_>>(),
        );
        fixture.edit("image.svg", &"after".repeat(1024));
        let result = fixture.compare().unwrap();
        assert_eq!(result.snapshot.changed_entries, ["card"]);
        assert_eq!(result.review.affected.len(), size);
        (
            result.affected_lookups,
            result.validation_lookups,
            result.resource_work,
        )
    };
    let small = run(8);
    let large = run(32);
    assert!(small.0 > 0 && small.1 > 0 && small.2.reads > 0);
    assert!(large.0 * 2 <= small.0 * 9);
    assert!(large.1 * 2 <= small.1 * 9);
    assert_eq!(large.2.reads, small.2.reads);
    assert_eq!(large.2.read_bytes, small.2.read_bytes);
}
