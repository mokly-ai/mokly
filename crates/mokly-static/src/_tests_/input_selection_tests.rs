//! Unreferenced repository edits do not invalidate a static catalogue.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;

use mokly_catalogue::config_types::{Config, ResolvedConfig, ResolvedRoot, RootConfig};

use crate::input_selection::verify;

#[test]
fn verifies_only_source_membership_explicit_inputs_and_the_reached_closure() {
    let config = ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: vec![],
        roots: vec![ResolvedRoot {
            input: RootConfig {
                dir: "specs".into(),
                files: None,
                path: None,
                transparent: None,
            },
            directory: "/repo/specs".into(),
            identity: "/repo/specs".into(),
        }],
    };
    for (path, selected) in [
        ("src/application.rs", false),
        ("unused.png", false),
        ("specs/new.screen.html", true),
        ("specs/_folder.json", true),
        ("helpers/render.ts", true),
        ("public/logo.svg", true),
    ] {
        let before = BTreeMap::new();
        let after = BTreeMap::from([(PathBuf::from("/repo").join(path), "digest".into())]);
        let result = verify(
            &config,
            &["helpers/render.ts".into()],
            &BTreeSet::from(["public/logo.svg".into()]),
            &before,
            &after,
        );
        assert_eq!(result.is_err(), selected, "{path}");
    }
}
