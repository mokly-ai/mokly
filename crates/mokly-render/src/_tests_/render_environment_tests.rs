use std::collections::BTreeMap;

use mokly_sidecar::compiled::CompiledGeneration;
use mokly_sidecar::methods::{Bundle, ModuleResolution};
use mokly_sidecar::results;

use super::{ClassMaps, derive, package, resolution};

fn params(source_root: &str) -> Bundle {
    Bundle {
        evaluation: Some(format!("evaluation of {source_root}")),
        entry_files: vec![format!("{source_root}-entries")],
        renderer: Some("renderer.tsx".into()),
        stories_files: Vec::new(),
        module_resolution: ModuleResolution {
            dependency_root: Some("/work/repo".into()),
            package_roots: vec!["/work/repo".into()],
            ..ModuleResolution::default()
        },
        source_root: source_root.into(),
        configuration_directory: "examples/basic".into(),
        repository_roots: vec!["/work/repo".into()],
    }
}

fn result(dependency_root: &str, react: &str) -> results::Bundle {
    results::Bundle {
        unmapped_dependency_directories: None,
        epoch: 0,
        compiled: Some(CompiledGeneration {
            unmapped_dependency_directories: None,
            identity: "identity".into(),
            code: String::new(),
            runtime_key: String::new(),
            dependency_roots: vec![dependency_root.into()],
            css_modules: Vec::new(),
            sources: BTreeMap::new(),
            peers: BTreeMap::from([("react".to_owned(), Some(react.to_owned()))]),
            inputs: BTreeMap::new(),
            metadata_inputs: BTreeMap::from([("package.json".to_owned(), Some("root".to_owned()))]),
            input_directories: BTreeMap::new(),
            metadata_directories: BTreeMap::new(),
        }),
        generation: "generation".into(),
        modules: Vec::new(),
        warnings: Vec::new(),
    }
}

fn maps(local: &str) -> ClassMaps {
    BTreeMap::from([
        (
            "a.module.css".to_owned(),
            BTreeMap::from([(local.to_owned(), format!("scoped-{local}"))]),
        ),
        (
            "b.module.css".to_owned(),
            BTreeMap::from([("card".to_owned(), "scoped-card".to_owned())]),
        ),
    ])
}

#[test]
fn equal_settings_under_two_source_roots_share_one_environment() {
    let react = "/work/repo/node_modules/react/index.js";
    let head = derive(
        &params("/work/repo"),
        &result("/work/repo/node_modules", react),
        &maps("x"),
    );
    let base = derive(
        &params("/cache/base"),
        &result("/work/repo/node_modules", react),
        &maps("x"),
    );
    assert_eq!(head.unwrap().environment, base.unwrap().environment);
}

#[test]
fn another_installation_or_runtime_package_changes_the_environment() {
    let react = "/work/repo/node_modules/react/index.js";
    let head = derive(
        &params("/work/repo"),
        &result("/work/repo/node_modules", react),
        &maps("x"),
    )
    .unwrap();
    let installed = derive(
        &params("/cache/base"),
        &result("/cache/install/node_modules", react),
        &maps("x"),
    )
    .unwrap();
    let peer = derive(
        &params("/work/repo"),
        &result(
            "/work/repo/node_modules",
            "/work/repo/node_modules/react/cjs.js",
        ),
        &maps("x"),
    )
    .unwrap();
    assert_ne!(head.environment, installed.environment);
    assert_ne!(head.environment, peer.environment);
}

#[test]
fn class_map_digests_change_only_for_the_changed_stylesheet() {
    let react = "/work/repo/node_modules/react/index.js";
    let before = derive(&params("/r"), &result("/r/node_modules", react), &maps("x")).unwrap();
    let after = derive(&params("/r"), &result("/r/node_modules", react), &maps("y")).unwrap();
    assert_ne!(
        before.class_map_digests["a.module.css"],
        after.class_map_digests["a.module.css"]
    );
    assert_eq!(
        before.class_map_digests["b.module.css"],
        after.class_map_digests["b.module.css"]
    );
    assert_eq!(before.environment, after.environment);
}

#[test]
fn resolution_names_drop_the_installed_prefix_previews_and_absent_files() {
    let inputs = BTreeMap::from([
        (
            "node_modules/.mokly-roots/installed/node_modules/pkg/package.json".to_owned(),
            Some("pkg".to_owned()),
        ),
        ("package.json".to_owned(), Some("root".to_owned())),
        ("specs/tsconfig.json".to_owned(), None),
        (
            ".storybook/preview.tsx".to_owned(),
            Some("preview".to_owned()),
        ),
    ]);
    assert_eq!(
        resolution(&inputs),
        BTreeMap::from([
            ("node_modules/pkg/package.json".to_owned(), "pkg".to_owned()),
            ("package.json".to_owned(), "root".to_owned()),
        ])
    );
}

#[test]
fn runtime_package_names_drop_subpaths_and_keep_scopes() {
    assert_eq!(package("react-dom/server"), "react-dom");
    assert_eq!(
        package("@emotion/server/create-instance"),
        "@emotion/server"
    );
    assert_eq!(package("react"), "react");
}
