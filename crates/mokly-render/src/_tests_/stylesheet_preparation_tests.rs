//! Preparation probes retain successful and failed root checks for the attempt.

use std::sync::{Arc, Mutex};

use mokly_css::error::CssError;
use mokly_css::types::StylesheetBundler;
use unimock::{MockFn, Unimock, matching};

use crate::stylesheet_compiler::{CompileRoot, StylesheetPreparation};
use crate::stylesheet_store::StylesheetCache;

use super::stylesheet_support::{Calls, assert_same, attempt, bundle, fill, roots, tree};

#[test]
fn stale_postcss_probes_retain_both_hits_and_misses() {
    let roots = roots(2);
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    fill(&shared, &roots);
    let calls = Arc::new(Calls::default());
    let attempt = attempt(
        Arc::new(Unimock::new(CompileRoot.some_call(matching!(_)).returns(
            Err(CssError::PostcssUnavailable {
                module: "fixture".into(),
            }),
        ))),
        tree(&calls, &["root-01.css"]),
        &shared,
    );
    assert!(attempt.stale_postcss());
    let checks = Calls::count(&calls.other_digests);
    assert!(checks > 0);
    assert_same(&attempt.bundle(&roots[0]).unwrap(), &bundle(&roots[0]));
    let failure = attempt.bundle(&roots[1]).unwrap_err();
    assert!(matches!(failure, CssError::PostcssUnavailable { module } if module == "fixture"));
    assert_eq!(Calls::count(&calls.other_digests), checks);
}
