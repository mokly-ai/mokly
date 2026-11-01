//! Real stylesheet cache bundles expose each miss reason through `css.bundle` spans.

use std::mem::size_of;
use std::sync::{Arc, Mutex};

use mokly_css::types::{StylesheetBundler, StylesheetBundlerMock};
use mokly_source_interface::read_evidence::ReadBaseline;
use tracing::span::{Attributes, Id, Record};
use tracing::{Event, Metadata, Subscriber};
use unimock::{MockFn, Unimock, matching};

use super::stylesheet_support::{attempt, bundle, bundler, fill, key, module, root, roots, tree};
use crate::stylesheet_store::StylesheetCache;

struct Capture {
    spans: Mutex<Vec<Option<String>>>,
    next: Mutex<u64>,
}

impl Default for Capture {
    fn default() -> Self {
        Self {
            spans: Mutex::default(),
            next: Mutex::new(1),
        }
    }
}

impl Capture {
    fn spans(&self) -> Vec<Option<String>> {
        self.spans.lock().unwrap().clone()
    }
}

struct Fields<'a> {
    cache: &'a mut Option<String>,
}

impl tracing::field::Visit for Fields<'_> {
    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        if field.name() == "cache" {
            *self.cache = Some(value.to_owned());
        }
    }

    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        if field.name() == "cache" {
            *self.cache = Some(format!("{value:?}"));
        }
    }
}

impl Subscriber for Capture {
    fn enabled(&self, _: &Metadata<'_>) -> bool {
        true
    }

    fn new_span(&self, attributes: &Attributes<'_>) -> Id {
        let mut cache = None;
        attributes.record(&mut Fields { cache: &mut cache });
        let mut next = self.next.lock().unwrap();
        let id = Id::from_u64(*next);
        *next += 1;
        if attributes.metadata().name() == "css.bundle" {
            self.spans.lock().unwrap().push(cache);
        }
        id
    }

    fn record(&self, _: &Id, _: &Record<'_>) {}
    fn record_follows_from(&self, _: &Id, _: &Id) {}
    fn event(&self, _: &Event<'_>) {}
    fn enter(&self, _: &Id) {}
    fn exit(&self, _: &Id) {}
}

fn capture_bundle(
    shared: &Arc<Mutex<StylesheetCache>>,
    inner: Arc<dyn StylesheetBundler>,
    root: &mokly_css::types::StylesheetRoot,
    tree: Arc<dyn mokly_source_interface::tree::SourceTree>,
) -> Vec<Option<String>> {
    let capture = Arc::new(Capture::default());
    tracing::subscriber::with_default(capture.clone(), || {
        attempt(inner, tree, shared).bundle(root).unwrap();
    });
    capture.spans()
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
