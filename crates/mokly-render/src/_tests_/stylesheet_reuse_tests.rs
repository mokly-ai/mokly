//! The module evidence of one PostCSS context is stored and checked once for all of its bundles.

use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_css::types::{Bundle, StylesheetBundler, StylesheetBundlerMock, StylesheetRoot};
use mokly_model::material::digest;
use mokly_source_interface::read_evidence::ReadEvidence;
use unimock::{MockFn, Unimock, matching};

use super::stylesheet_support::{
    Calls, MODULES, assert_same, attempt, bundle, bundler, charges, fill, key, module, roots, tree,
};
use crate::source_paths::SOURCE_INPUT_PREFIX;
use crate::stylesheet_record::ContextEvidence;
use crate::stylesheet_store::{Miss, StylesheetCache};

const BOUND: usize = 64 * 1024 * 1024;

fn module_bundle(root: &StylesheetRoot, count: usize) -> Bundle {
    let mut bundle = bundle(root);
    bundle.read_evidence.inputs.retain(|path, _| {
        path.starts_with(SOURCE_INPUT_PREFIX) || (0..count).any(|index| path == &module(index))
    });
    bundle
}

fn module_evidence(bundle: &Bundle) -> ReadEvidence {
    let mut evidence = ReadEvidence::default();
    for (path, versions) in &bundle.read_evidence.inputs {
        if !path.starts_with(SOURCE_INPUT_PREFIX) {
            evidence.inputs.insert(path.clone(), versions.clone());
        }
    }
    evidence
}

fn full_context_bytes(
    bundle: &Bundle,
    tree: &Arc<dyn mokly_source_interface::tree::SourceTree>,
) -> usize {
    let evidence = module_evidence(bundle);
    ContextEvidence::with_base(
        tree.as_ref(),
        Path::new("/repo"),
        digest(format!("{:?}", evidence.inputs).as_bytes()),
        evidence,
        None,
    )
    .bytes
}

#[test]
fn thirty_nine_records_with_shared_module_evidence_fit_in_one_store() {
    let tree = tree(&Arc::default(), &[]);
    let (record, context) = charges(&tree);
    assert!(39 * (record + context) > BOUND);
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let calls = Arc::new(AtomicUsize::new(0));
    let first = attempt(bundler(calls.clone()), tree.clone(), &shared);
    for root in roots(39) {
        first.bundle(&root).unwrap();
    }
    assert_eq!(calls.load(Ordering::SeqCst), 39);
    let second = attempt(Arc::new(Unimock::new(())), tree, &shared);
    for root in roots(39) {
        assert_same(&second.bundle(&root).unwrap(), &bundle(&root));
    }
}

#[test]
fn finding_3_thirty_nine_growing_contexts_fit_without_full_copies() {
    let roots = roots(39);
    let tree = tree(&Arc::default(), &[]);
    let (record, context) = charges(&tree);
    assert!(39 * (record + context) > BOUND);
    let responses = Arc::new(Mutex::new(
        roots
            .iter()
            .enumerate()
            .map(|(index, root)| module_bundle(root, MODULES - 39 + index + 1))
            .collect::<Vec<_>>(),
    ));
    let answers = responses.clone();
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let first = attempt(
        Arc::new(Unimock::new(
            StylesheetBundlerMock::bundle
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| Ok(answers.lock().unwrap().remove(0)))),
        )),
        tree.clone(),
        &shared,
    );
    for root in &roots {
        first.bundle(root).unwrap();
    }

    let second = attempt(Arc::new(Unimock::new(())), tree, &shared);
    for root in &roots {
        assert!(second.bundle(root).is_ok());
    }
}

#[test]
fn finding_3_growing_context_evidence_charges_only_added_versions() {
    let first_root = roots(2).remove(0);
    let roots = roots(2);
    let first_bundle = module_bundle(&first_root, 1);
    let second_bundle = module_bundle(&roots[1], 2);
    let tree = tree(&Arc::default(), &[]);
    let full_second_bytes = full_context_bytes(&second_bundle, &tree);
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let responses = Arc::new(Mutex::new(vec![first_bundle, second_bundle]));
    let answers = responses.clone();
    let attempt = attempt(
        Arc::new(Unimock::new(
            StylesheetBundlerMock::bundle
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| Ok(answers.lock().unwrap().remove(0)))),
        )),
        tree,
        &shared,
    );

    attempt.bundle(&first_root).unwrap();
    attempt.bundle(&roots[1]).unwrap();

    let second_digest = {
        let evidence = module_evidence(&module_bundle(&roots[1], 2));
        digest(format!("{:?}", evidence.inputs).as_bytes())
    };
    let second = shared.lock().unwrap().context(&second_digest).unwrap();
    assert!(second.bytes < full_second_bytes);
    let first_digest = {
        let evidence = module_evidence(&module_bundle(&first_root, 1));
        digest(format!("{:?}", evidence.inputs).as_bytes())
    };
    let first = shared.lock().unwrap().context(&first_digest).unwrap();
    assert!(
        second
            .base
            .as_ref()
            .is_some_and(|base| Arc::ptr_eq(base, &first))
    );
}

#[test]
fn finding_3_a_chain_hit_returns_the_inner_bundle_and_full_evidence() {
    let roots = roots(2);
    let first_bundle = module_bundle(&roots[0], 1);
    let second_bundle = module_bundle(&roots[1], 2);
    let expected_first = first_bundle.clone();
    let expected_second = second_bundle.clone();
    let responses = Arc::new(Mutex::new(vec![first_bundle, second_bundle]));
    let answers = responses.clone();
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let first = attempt(
        Arc::new(Unimock::new(
            StylesheetBundlerMock::bundle
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| Ok(answers.lock().unwrap().remove(0)))),
        )),
        tree(&Arc::default(), &[]),
        &shared,
    );
    first.bundle(&roots[0]).unwrap();
    first.bundle(&roots[1]).unwrap();

    let calls = Arc::new(Calls::default());
    let second = attempt(Arc::new(Unimock::new(())), tree(&calls, &[]), &shared);
    assert_same(&second.bundle(&roots[0]).unwrap(), &expected_first);
    assert_same(&second.bundle(&roots[1]).unwrap(), &expected_second);
    let observed = calls.observed.lock().unwrap();
    for index in 0..2 {
        let path = Path::new("/repo").join(module(index));
        assert_eq!(
            observed
                .iter()
                .filter(|(observed, _)| *observed == path)
                .count(),
            1
        );
    }
}

#[test]
fn finding_3_changed_base_module_misses_every_record_and_checks_each_entry() {
    let roots = roots(2);
    let responses = Arc::new(Mutex::new(vec![
        module_bundle(&roots[0], 1),
        module_bundle(&roots[1], 2),
    ]));
    let answers = responses.clone();
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let first = attempt(
        Arc::new(Unimock::new(
            StylesheetBundlerMock::bundle
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| Ok(answers.lock().unwrap().remove(0)))),
        )),
        tree(&Arc::default(), &[]),
        &shared,
    );
    first.bundle(&roots[0]).unwrap();
    first.bundle(&roots[1]).unwrap();

    let calls = Arc::new(Calls::default());
    let second = attempt(
        Arc::new(Unimock::new(())),
        tree(&calls, &["module-000.js"]),
        &shared,
    );
    assert_eq!(
        second.lookup(&key(&roots[0])).err(),
        Some(Miss::StampMismatch)
    );
    assert_eq!(
        second.lookup(&key(&roots[1])).err(),
        Some(Miss::StampMismatch)
    );
    assert_eq!(Calls::count(&calls.module_digests), 2);
}

/// The tree calls of a second attempt that hits `count` roots.
fn hit_calls(count: usize) -> Arc<Calls> {
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    fill(&shared, &roots(count));
    let calls = Arc::new(Calls::default());
    let second = attempt(Arc::new(Unimock::new(())), tree(&calls, &[]), &shared);
    for root in roots(count) {
        second.bundle(&root).unwrap();
    }
    calls
}

#[test]
fn hits_check_the_shared_module_stamp_once_for_each_attempt() {
    let (small, large) = (hit_calls(2), hit_calls(8));
    assert_eq!(Calls::count(&small.module_digests), MODULES);
    assert_eq!(Calls::count(&large.module_digests), MODULES);
    assert_eq!(Calls::count(&small.identities), MODULES);
    assert_eq!(Calls::count(&large.identities), MODULES);
    assert!(Calls::count(&small.other_digests) > 0);
    assert_eq!(
        Calls::count(&large.other_digests),
        Calls::count(&small.other_digests) * 4
    );
}

#[test]
fn a_hit_returns_the_bundle_of_its_miss_and_replays_the_same_observations() {
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let (missed, hit) = (Arc::new(Calls::default()), Arc::new(Calls::default()));
    let first = attempt(bundler(Arc::default()), tree(&missed, &[]), &shared);
    let second = attempt(Arc::new(Unimock::new(())), tree(&hit, &[]), &shared);
    for root in roots(2) {
        assert_same(&first.bundle(&root).unwrap(), &bundle(&root));
    }
    for root in roots(2) {
        assert_same(&second.bundle(&root).unwrap(), &bundle(&root));
        assert_same(&second.bundle(&root).unwrap(), &bundle(&root));
    }
    let mut missed = missed.observed.lock().unwrap().clone();
    let mut hit = hit.observed.lock().unwrap().clone();
    assert_eq!(missed.len(), MODULES + 2);
    assert_eq!(hit.len(), MODULES + 4);
    let module = Path::new("/repo").join(module(0));
    assert_eq!(hit.iter().filter(|(path, _)| *path == module).count(), 1);
    missed.sort();
    hit.sort();
    hit.dedup();
    assert_eq!(hit, missed);
}

#[test]
fn a_changed_module_file_makes_every_record_of_its_context_miss_with_stamp_mismatch() {
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    fill(&shared, &roots(3));
    let calls = Arc::new(Calls::default());
    let second = attempt(
        Arc::new(Unimock::new(())),
        tree(&calls, &["module-000.js"]),
        &shared,
    );
    for root in roots(3) {
        assert_eq!(second.lookup(&key(&root)).err(), Some(Miss::StampMismatch));
    }
    assert_eq!(Calls::count(&calls.module_digests), MODULES);
}
