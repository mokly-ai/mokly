//! Attempt indexes must not retain context payloads after both bounded stores release them.

use std::sync::{Arc, Mutex};

use mokly_css::types::StylesheetBundler;
use mokly_model::material::digest;
use unimock::Unimock;

use crate::stylesheet_store::StylesheetCache;

use super::stylesheet_chain_support::{module_bundle, module_evidence};
use super::stylesheet_support::{attempt, bundler, key, roots, tree};

#[test]
fn finding_8_rejected_records_leave_no_context_payload_in_the_attempt_memo() {
    let root = &roots(1)[0];
    let shared = Arc::new(Mutex::new(StylesheetCache::new(0)));
    let compiler = attempt(bundler(Arc::default()), tree(&Arc::default(), &[]), &shared);
    let actual = compiler.bundle(root).unwrap();
    assert!(shared.lock().unwrap().record(&key(root)).is_none());
    assert!(compiler.local.lock().unwrap().record(&key(root)).is_none());
    let evidence = module_evidence(&actual);
    let weak = Arc::downgrade(&compiler.context(
        digest(format!("{:?}", evidence.inputs).as_bytes()),
        evidence,
    ));
    assert!(weak.upgrade().is_none());
    for count in 1..=3 {
        let evidence = module_evidence(&module_bundle(root, count));
        let weak = Arc::downgrade(&compiler.context(
            digest(format!("{:?}", evidence.inputs).as_bytes()),
            evidence,
        ));
        assert!(weak.upgrade().is_none());
        assert_eq!(compiler.contexts.lock().unwrap().len(), 1);
    }
}

#[test]
fn finding_8_stamp_check_memo_releases_entries_when_both_stores_remove_them() {
    let root = &roots(1)[0];
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    {
        let first = attempt(bundler(Arc::default()), tree(&Arc::default(), &[]), &shared);
        first.bundle(root).unwrap();
    }
    let compiler = attempt(
        Arc::new(Unimock::new(())),
        tree(&Arc::default(), &[]),
        &shared,
    );
    let weak = {
        let record = compiler.lookup(&key(root)).unwrap();
        Arc::downgrade(record.context.as_ref().unwrap())
    };
    assert!(weak.upgrade().is_some());
    shared.lock().unwrap().reject(key(root));
    compiler.local.lock().unwrap().reject(key(root));
    assert!(weak.upgrade().is_none());
}
