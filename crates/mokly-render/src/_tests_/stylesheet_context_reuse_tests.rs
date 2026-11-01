//! Newly compiled roots reuse valid stored contexts and extend cumulative evidence.

use std::sync::{Arc, Mutex};

use mokly_css::types::{Bundle, StylesheetBundler, StylesheetBundlerMock, StylesheetRoot};
use mokly_source_interface::read_evidence::ReadBaseline;
use unimock::{MockFn, Unimock, matching};

use crate::stylesheet_record::ContextEvidence;
use crate::stylesheet_store::StylesheetCache;

use super::stylesheet_chain_support::module_bundle;
use super::stylesheet_support::{Calls, DIGEST, attempt, key, module, roots, tree};

fn inner(bundle: Bundle) -> Arc<dyn StylesheetBundler> {
    Arc::new(Unimock::new(
        StylesheetBundlerMock::bundle
            .next_call(matching!(_))
            .returns(Ok(bundle)),
    ))
}

fn context(shared: &Mutex<StylesheetCache>, root: &StylesheetRoot) -> Arc<ContextEvidence> {
    shared
        .lock()
        .unwrap()
        .record(&key(root))
        .unwrap()
        .context
        .clone()
        .unwrap()
}

#[test]
fn finding_5_changed_root_reuses_stored_context_in_a_new_record() {
    let root = &roots(1)[0];
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let first = attempt(
        inner(module_bundle(root, 1)),
        tree(&Arc::default(), &[]),
        &shared,
    );
    first.bundle(root).unwrap();
    let old = context(&shared, root);
    let calls = Arc::new(Calls::default());
    let second = attempt(
        inner(module_bundle(root, 1)),
        tree(&calls, &["root-00.css"]),
        &shared,
    );
    second.bundle(root).unwrap();
    let new = context(&shared, root);
    assert!(Arc::ptr_eq(&old, &new));
    assert_eq!(Calls::count(&calls.module_digests), 1);
}

#[test]
fn finding_5_changed_module_creates_a_new_context_for_the_new_record() {
    let root = &roots(1)[0];
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let first = attempt(
        inner(module_bundle(root, 1)),
        tree(&Arc::default(), &[]),
        &shared,
    );
    first.bundle(root).unwrap();
    let old = context(&shared, root);
    let mut changed = module_bundle(root, 1);
    let versions = changed.read_evidence.inputs.get_mut(&module(0)).unwrap();
    versions.retain(|version| version.whole_digest() != Some(DIGEST));
    versions.insert(ReadBaseline::Late("1".repeat(64)));
    let second = attempt(
        inner(changed.clone()),
        tree(&Arc::default(), &["module-000.js"]),
        &shared,
    );
    let result = second.bundle(root).unwrap();
    let new = context(&shared, root);
    assert!(!Arc::ptr_eq(&old, &new));
    assert!(new.base.is_none());
    assert_eq!(result.read_evidence, changed.read_evidence);
}

#[test]
fn finding_5_changed_root_with_growing_evidence_links_to_the_stored_context() {
    let root = &roots(1)[0];
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let first = attempt(
        inner(module_bundle(root, 1)),
        tree(&Arc::default(), &[]),
        &shared,
    );
    first.bundle(root).unwrap();
    let old = context(&shared, root);
    let grown = module_bundle(root, 2);
    let calls = Arc::new(Calls::default());
    let second = attempt(
        inner(grown.clone()),
        tree(&calls, &["root-00.css"]),
        &shared,
    );
    let result = second.bundle(root).unwrap();
    let new = context(&shared, root);
    assert!(
        new.base
            .as_ref()
            .is_some_and(|base| Arc::ptr_eq(base, &old))
    );
    assert_eq!(
        new.evidence.inputs.keys().cloned().collect::<Vec<_>>(),
        [module(1)]
    );
    assert_eq!(result.read_evidence, grown.read_evidence);
    assert_eq!(Calls::count(&calls.module_digests), 1);
}
