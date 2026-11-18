//! Real stylesheet cache bundles expose each miss reason through `css.bundle` spans.

use std::mem::size_of;
use std::sync::{Arc, Mutex};

use mokly_css::types::{StylesheetBundler, StylesheetBundlerMock};
use mokly_source_interface::read_evidence::ReadBaseline;
use mokly_test_support::capture::Trace;
use unimock::{MockFn, Unimock, matching};

use crate::stylesheet_store::StylesheetCache;

use super::stylesheet_support::{attempt, bundle, bundler, fill, key, module, root, roots, tree};

fn capture_bundle(
    shared: &Arc<Mutex<StylesheetCache>>,
    inner: Arc<dyn StylesheetBundler>,
    root: &mokly_css::types::StylesheetRoot,
    tree: Arc<dyn mokly_source_interface::tree::SourceTree>,
) -> Vec<Option<String>> {
    let capture = Trace::default();
    capture.in_scope(|| {
        attempt(inner, tree, shared).bundle(root).unwrap();
    });
    capture
        .spans()
        .into_iter()
        .filter(|span| span.name == "css.bundle")
        .map(|span| span.fields.get("cache").cloned())
        .collect()
}

#[test]
fn finding_4_real_bundles_report_each_miss_reason_and_hits_are_silent() {
    let root = root("trace.css");
    let no_record = capture_bundle(
        &Arc::new(Mutex::new(StylesheetCache::default())),
        Arc::new(Unimock::new(
            StylesheetBundlerMock::bundle
                .next_call(matching!(_))
                .returns(Ok(bundle(&root))),
        )),
        &root,
        tree(&Arc::default(), &[]),
    );
    assert_eq!(no_record, vec![Some("no-record".into())]);

    let roots = roots(2);
    let (record, context) = super::stylesheet_support::charges(&tree(&Arc::default(), &[]));
    let bound = size_of::<String>() + key(&roots[0]).capacity() + record + context + record / 2;
    let shared = Arc::new(Mutex::new(StylesheetCache::new(bound)));
    fill(&shared, &roots);
    let evicted = capture_bundle(
        &shared,
        bundler(Arc::default()),
        &roots[0],
        tree(&Arc::default(), &[]),
    );
    assert_eq!(evicted, vec![Some("evicted".into())]);

    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    fill(&shared, std::slice::from_ref(&root));
    let stamp_mismatch = capture_bundle(
        &shared,
        bundler(Arc::default()),
        &root,
        tree(&Arc::default(), &["trace.css"]),
    );
    assert_eq!(stamp_mismatch, vec![Some("stamp-mismatch".into())]);

    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let mut disagreeing = bundle(&root);
    disagreeing
        .read_evidence
        .insert(module(0), ReadBaseline::Late("1".repeat(64)));
    let first = attempt(
        Arc::new(Unimock::new(
            StylesheetBundlerMock::bundle
                .next_call(matching!(_))
                .returns(Ok(disagreeing)),
        )),
        tree(&Arc::default(), &[]),
        &shared,
    );
    first.bundle(&root).unwrap();
    let inconsistent = capture_bundle(
        &shared,
        bundler(Arc::default()),
        &root,
        tree(&Arc::default(), &[]),
    );
    assert_eq!(inconsistent, vec![Some("inconsistent-evidence".into())]);

    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    fill(&shared, std::slice::from_ref(&root));
    let hit = capture_bundle(
        &shared,
        Arc::new(Unimock::new(())),
        &root,
        tree(&Arc::default(), &[]),
    );
    assert!(hit.is_empty());
}
