//! Selector extraction keeps its library allowance without using recursive walkers.

use std::thread;

use crate::selector_nesting::combine;
use crate::selector_scope::broaden;

#[test]
fn deep_selector_broadening_and_substitution_use_a_small_stack() {
    thread::Builder::new()
        .stack_size(64 * 1024)
        .spawn(|| {
            let before = ":is(".repeat(60);
            let after = ")".repeat(60);
            let scope = broaden(&format!("{before}.a:hover{after}"));
            assert_eq!(scope.text, format!("{before}.a{after}"));
            assert!(scope.dynamic);
            assert!(!scope.unresolved);
            assert_eq!(
                combine(&format!("{before}&{after}"), Some(".parent")),
                Some(format!("{before}:is(.parent){after}"))
            );
        })
        .unwrap()
        .join()
        .unwrap();
}

#[test]
fn selector_extraction_retains_the_existing_75_block_allowance() {
    for depth in [75, 76, 512] {
        let source = format!("{}.a{}", ":is(".repeat(depth), ")".repeat(depth));
        assert_eq!(broaden(&source).unresolved, depth > 75);
        assert_eq!(combine(&source, Some(".parent")).is_none(), depth > 75);
    }
}

#[test]
fn nesting_does_not_rewrite_attribute_strings_and_broadening_keeps_shadow_checks() {
    assert_eq!(
        combine("[data-x='&']:is(&)", Some(".parent")).unwrap(),
        "[data-x='&']:is(:is(.parent))"
    );
    assert!(broaden(".a:is(:host(.b))").unresolved);
    let scope = broaden(".a:not(:has(:hover))");
    assert_eq!(scope.text, ".a");
    assert!(scope.dynamic);
}
