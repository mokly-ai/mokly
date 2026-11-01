//! Render environment resolution, runtime packages, and CSS class maps.

use std::collections::BTreeMap;

use super::render_environment_support::{derive, maps, params, result};
use super::{package, resolution};

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
        resolution(&inputs, true),
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

#[test]
fn preview_candidates_stay_when_the_graph_names_no_preview() {
    let inputs = BTreeMap::from([(
        ".storybook/preview.tsx".to_owned(),
        Some("preview".to_owned()),
    )]);
    assert_eq!(
        resolution(&inputs, false),
        BTreeMap::from([(".storybook/preview.tsx".to_owned(), "preview".to_owned())])
    );
    assert_eq!(resolution(&inputs, true), BTreeMap::new());
}
