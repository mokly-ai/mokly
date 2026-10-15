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
        cache.stats()
    };
    let smaller = count(16);
    let larger = count(64);
    assert_eq!(smaller.parses, 2);
    assert_eq!(larger.parses, smaller.parses);
    assert!(smaller.hits > 0);
    assert!(larger.hits * 2 <= smaller.hits * 9);
}
