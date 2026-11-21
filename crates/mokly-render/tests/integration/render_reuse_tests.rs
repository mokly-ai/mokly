//! Real Serve-head preparations keep the document keys of full runtime preparations.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_graph::types::{GraphFactory, RenderGeneration};
use mokly_sidecar::methods::BundleCapture;

use super::render_key_tests::{consumer, moved};
use super::support::Consumer;

fn keys(generation: &dyn RenderGeneration) -> BTreeMap<String, String> {
    generation
        .plans()
        .iter()
        .map(|(route, plan)| (route.clone(), plan.key.0.clone()))
        .collect()
}

fn check_full(consumer: &Consumer, generation: &dyn RenderGeneration) {
    let runtime = consumer.runtime.for_base(
        consumer.runtime.tree.clone(),
        consumer.runtime.version.clone(),
        None,
    );
    let full = runtime
        .create(&consumer.config())
        .unwrap()
        .prepare(consumer.config(), generation.catalogue().clone(), None)
        .unwrap();
    assert_eq!(keys(generation), keys(full.as_ref()));
}

#[test]
fn serve_edits_keep_full_document_keys_through_runtime_attempt_copies() {
    let mut consumer = consumer();
    consumer.runtime = Arc::new((*consumer.runtime).clone().with_serve_edit_plans());
    let mut current = consumer.generation(consumer.prepare().unwrap());
    check_full(&consumer, current.as_ref());
    Arc::make_mut(&mut consumer.runtime).bundle_capture = BundleCapture::ServeEdit;
    for (path, before, after, expected) in [
        ("specs/h.ts", "Hello", "Hello edited", vec!["s/s"]),
        (
            "specs/t/t.mockup.tsx",
            "title: \"T\"",
            "title: \"Target renamed\"",
            vec!["s/s", "t/t"],
        ),
    ] {
        let previous = keys(current.as_ref());
        consumer.replace(path, before, after);
        let prepared = consumer.prepare().unwrap();
        let attempt = consumer.runtime.with_tree(consumer.runtime.tree.clone());
        let next = attempt
            .create(&consumer.config())
            .unwrap()
            .prepare(consumer.config(), prepared, None)
            .unwrap();
        check_full(&consumer, next.as_ref());
        assert_eq!(
            moved(&previous, &keys(next.as_ref())),
            expected
                .into_iter()
                .map(str::to_owned)
                .collect::<BTreeSet<_>>()
        );
        current = next;
    }
}
