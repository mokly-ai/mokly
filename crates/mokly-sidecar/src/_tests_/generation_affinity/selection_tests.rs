//! Idle holders win only inside the root and return-pass eligibility groups.

use std::collections::VecDeque;

use crate::methods::{BundleRequest, Call, ProcessCss};
use crate::pool_state::Affinity;

use super::support::{Loaded, acquire, bundle, pool, render};

#[test]
fn holders_precede_non_holders_with_fifo_ties_and_immediate_fallback() {
    let pool = pool(&[
        ("/head", Loaded::None),
        ("/head", Loaded::Generation),
        ("/head", Loaded::Generation),
    ]);
    pool.lock().available = VecDeque::from([0, 2, 1]);
    let selected = (0..3)
        .map(|_| acquire(&pool, &render(), "/head"))
        .collect::<Vec<_>>();
    assert_eq!(selected, [2, 1, 0]);
    assert_eq!(pool.lock().slots.len(), 3);
}

#[test]
fn root_and_return_pass_groups_rank_holders_without_overriding_eligibility() {
    for (slots, candidates, expected) in [
        (
            vec![("/base", Loaded::None), ("/base", Loaded::Ready)],
            vec![1],
            0,
        ),
        (
            vec![
                ("/base", Loaded::Generation),
                ("/base", Loaded::Ready),
                ("/base", Loaded::Ready),
            ],
            vec![2],
            1,
        ),
        (
            vec![("/base", Loaded::Generation), ("/base", Loaded::Ready)],
            vec![0, 1],
            1,
        ),
        (
            vec![("/other", Loaded::Ready), ("/base", Loaded::None)],
            vec![],
            1,
        ),
    ] {
        let pool = pool(&slots);
        pool.lock().head.candidates = candidates.iter().map(|index| (*index, 1)).collect();
        assert_eq!(
            acquire(&pool, &render(), "/base"),
            expected,
            "slots={slots:?}, candidates={candidates:?}"
        );
    }
}

#[test]
fn calls_without_generations_keep_fifo_and_live_context_affinity() {
    let css = Call::ProcessCss(ProcessCss {
        context: "context".into(),
        source_root: "/head".into(),
        repository_roots: vec![],
        module_resolution: Default::default(),
        postcss: "postcss.mjs".into(),
        source_path: "style.css".into(),
        text: String::new(),
    });
    for (call, affine, expected) in [
        (
            Call::Bundle(BundleRequest {
                params: bundle("/head"),
                capture: None,
            }),
            false,
            0,
        ),
        (css.clone(), false, 0),
        (css, true, 1),
        (render(), false, 1),
    ] {
        let pool = pool(&[("/head", Loaded::None), ("/head", Loaded::Ready)]);
        if affine {
            pool.lock().affinity.insert(
                "context".into(),
                Affinity {
                    index: 1,
                    source_root: "/head".into(),
                },
            );
        }
        assert_eq!(acquire(&pool, &call, "/head"), expected, "{call:?}");
    }
}
