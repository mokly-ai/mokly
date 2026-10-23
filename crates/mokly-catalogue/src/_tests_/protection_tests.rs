//! A new root match and a realpath alias remain private before any rendering.

use crate::config_types::{Config, ResolvedConfig, ResolvedRoot, RootConfig};
use crate::protection::{ProtectedBy, SourcePolicy};

#[test]
fn source_cause_precedence_applies_to_lexical_and_physical_names() {
    let config = ResolvedConfig {
        authored_inputs: Vec::new(),
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        roots: vec![ResolvedRoot {
            input: RootConfig {
                dir: "specs".into(),
                files: Some(vec!["**/*.ts".into(), "**/*.screen.html".into()]),
                path: None,
                transparent: None,
            },
            directory: "/repo/specs".into(),
            identity: "/repo/actual".into(),
        }],
    };
    let policy = SourcePolicy::new(
        &config,
        &["specs/private.source.ts".into(), "helpers/data.json".into()],
    )
    .unwrap();
    assert_eq!(
        policy.denial("specs/new.screen.html", None),
        Some(ProtectedBy::RootMatch { root: 0 })
    );
    assert_eq!(
        policy.denial("public/alias.html", Some("actual/new.screen.html")),
        Some(ProtectedBy::RootMatch { root: 0 })
    );
    assert_eq!(
        policy.denial("helpers/UNUSED.SOURCE.TSX", None),
        Some(ProtectedBy::ReservedBasename)
    );
    assert_eq!(
        policy.denial("public/alias.js", Some("helpers/UNUSED.SOURCE.TSX")),
        Some(ProtectedBy::ReservedBasename)
    );
    assert_eq!(
        policy.denial("helpers/data.json", None),
        Some(ProtectedBy::ListedInput)
    );
    assert_eq!(policy.denial("public/app.js", None), None);
    assert_eq!(
        policy.denial("specs/private.source.ts", None),
        Some(ProtectedBy::RootMatch { root: 0 })
    );
}
