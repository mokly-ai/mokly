//! Catalogue boundaries protect package manifests at normalized roots and `..` spellings.

use std::path::PathBuf;

use mokly_catalogue::config_types::{Config, ModuleResolution, ResolvedConfig};

use crate::location::Boundary;

#[test]
fn package_manifests_use_normalized_roots_and_parent_spellings() {
    let config = ResolvedConfig {
        input: Config {
            module_resolution: Some(ModuleResolution {
                package_roots: Some(vec!["../packages/ui".into(), "..".into()]),
                ..Default::default()
            }),
            ..Default::default()
        },
        file: "/repo/tools/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    };
    let boundary = Boundary::catalogue(&config, "/repo".into());
    assert_eq!(
        boundary.inputs,
        [
            "/repo/tools/mokly.config.json",
            "/repo/package.json",
            "/repo/packages/ui/package.json",
            "/repo/package.json",
            "/repo/tools/../packages/ui/package.json",
            "/repo/tools/../package.json",
        ]
        .map(PathBuf::from)
    );
}
