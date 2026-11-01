//! Growing module evidence links to earlier evidence and replays without duplicates.

use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_css::types::{StylesheetBundler, StylesheetBundlerMock};
use mokly_model::material::digest;
use mokly_source_interface::read_evidence::ReadBaseline;
use unimock::{MockFn, Unimock, matching};

use crate::stylesheet_store::{Miss, StylesheetCache};

use super::stylesheet_chain_support::{full_context_bytes, module_bundle, module_evidence};
use super::stylesheet_support::{
    Calls, MODULES, assert_same, attempt, charges, key, module, roots, tree,
};

const BOUND: usize = 64 * 1024 * 1024;

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

#[test]
fn finding_3_largest_stored_subset_outweighs_a_smaller_attempt_entry() {
    let root = &roots(1)[0];
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let first = attempt(
        Arc::new(Unimock::new(
            StylesheetBundlerMock::bundle
                .next_call(matching!(_))
                .returns(Ok(module_bundle(root, 2))),
        )),
        tree(&Arc::default(), &[]),
        &shared,
    );
    first.bundle(root).unwrap();
    let stored = shared
        .lock()
        .unwrap()
        .record(&key(root))
        .unwrap()
        .context
        .clone()
        .unwrap();
    let next = attempt(
        Arc::new(Unimock::new(())),
        tree(&Arc::default(), &[]),
        &shared,
    );
    for count in [1, 3] {
        let evidence = module_evidence(&module_bundle(root, count));
        let entry = next.context(
            digest(format!("{:?}", evidence.inputs).as_bytes()),
            evidence,
        );
        if count == 3 {
            assert!(
                entry
                    .base
                    .as_ref()
                    .is_some_and(|base| Arc::ptr_eq(base, &stored))
            );
        }
    }
}

#[test]
fn finding_3_added_versions_are_checked_with_the_base_versions() {
    let roots = roots(2);
    let mut changed = module_bundle(&roots[1], 2);
    changed
        .read_evidence
        .insert(module(0), ReadBaseline::Late("1".repeat(64)));
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let responses = Arc::new(Mutex::new(vec![
        module_bundle(&roots[0], 1),
        changed.clone(),
    ]));
    let first = attempt(
        Arc::new(Unimock::new(
            StylesheetBundlerMock::bundle
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    Ok(responses.lock().unwrap().remove(0))
                })),
        )),
        tree(&Arc::default(), &[]),
        &shared,
    );
    first.bundle(&roots[0]).unwrap();
    assert_same(&first.bundle(&roots[1]).unwrap(), &changed);
    assert_eq!(
        shared.lock().unwrap().miss(&key(&roots[1])),
        Miss::InconsistentEvidence
    );
    assert!(shared.lock().unwrap().record(&key(&roots[1])).is_none());
}
