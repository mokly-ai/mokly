//! Both adapters preserve rule owners through capture, browser repair, and comparison.

use std::fs;

use super::base_styles_tests::{compare, consumer};
#[path = "../../../../tests/rust/registry_assertions.rs"]
mod registry_assertions;
#[path = "../../../../tests/rust/registry_fixture.rs"]
mod registry_fixture;

#[test]
fn registry_owner_matrix_for_styled_components_and_emotion() {
    for emotion in [false, true] {
        for edit in [
            registry_fixture::Edit::Stack,
            registry_fixture::Edit::Supplier,
            registry_fixture::Edit::ButtonAndStack,
        ] {
            let base = consumer("'black'");
            let head = consumer("'black'");
            for (target, changed) in [(&base, false), (&head, true)] {
                for (file, source) in registry_fixture::sources(emotion, edit, changed) {
                    fs::write(target.root().join("owned").join(file), source).unwrap();
                }
            }
            registry_assertions::check(&compare(&base, &head).review, edit);
        }
    }
}
