//! Collision behavior uses explicit identity inputs without searching for hash collisions.

use crate::names::ModuleNames;

#[test]
fn a_generated_identity_can_repeat_only_for_the_same_original_name_and_file() {
    let mut names = ModuleNames::default();
    names
        .record("shared".into(), "first.module.css", "a")
        .unwrap();
    names
        .record("shared".into(), "first.module.css", "a")
        .unwrap();
    assert!(
        names
            .record("shared".into(), "second.module.css", "a")
            .unwrap_err()
            .to_string()
            .contains("generated name collision")
    );
    assert!(
        names
            .record("shared".into(), "first.module.css", "b")
            .is_err()
    );
}
