//! Render environments use checkout-relative and cache-relative paths.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use super::render_environment_support::{
    cache_params, derive_at, maps, params, params_at, physical, result,
};
use super::{PathMapper, settings};

#[test]
fn environment_settings_map_every_physical_path_and_keep_null_peers() {
    let mut bundle = params_at("/work/repo");
    bundle.repository_roots.push(physical(
        "/cache/namespace/dependencies/entries/install/data",
    ));
    let mut compiled = result(
        "/work/repo/node_modules",
        "/work/repo/node_modules/react/index.js",
    );
    compiled
        .compiled
        .as_mut()
        .unwrap()
        .peers
        .insert("optional".into(), None);
    let working_root = physical("/work/repo");
    let cache_namespace = physical("/cache/namespace");
    let mut paths = PathMapper::new(Path::new(&working_root), Some(Path::new(&cache_namespace)));
    let mapped = settings(&bundle, &compiled, &mut paths);
    assert_eq!(
        mapped.repository_roots,
        [".", "cache:dependencies/entries/install/data"]
    );
    assert_eq!(mapped.dependency_roots, ["node_modules"]);
    assert_eq!(
        mapped.module_resolution.dependency_root.as_deref(),
        Some(".")
    );
    assert_eq!(
        mapped.module_resolution.package_roots,
        ["examples/basic", "."]
    );
    assert_eq!(
        mapped.peers,
        Some(BTreeMap::from([
            ("react".into(), Some("node_modules/react/index.js".into())),
            ("optional".into(), None),
        ]))
    );
    assert!(paths.external.is_empty());
    assert_eq!(bundle.repository_roots[0], physical("/work/repo"));
    assert_eq!(
        compiled.compiled.unwrap().peers["react"],
        Some(physical("/work/repo/node_modules/react/index.js"))
    );
}

#[test]
fn external_paths_stay_absolute_and_are_reported_without_prefix_matches() {
    let working_root = physical("/work/repo");
    let cache_namespace = physical("/cache/namespace");
    let mut paths = PathMapper::new(Path::new(&working_root), Some(Path::new(&cache_namespace)));
    for path in [
        "/work/repository/dependency",
        "/cache/namespace-other/dependency",
        "/outside/dependency",
    ] {
        let path = physical(path);
        assert_eq!(paths.map(&path), path);
    }
    assert_eq!(
        paths.external,
        BTreeSet::from([
            physical("/work/repository/dependency"),
            physical("/cache/namespace-other/dependency"),
            physical("/outside/dependency"),
        ])
    );
    assert_eq!(paths.map("relative/path"), "relative/path");
}

#[test]
fn equal_settings_under_two_working_repository_roots_share_one_environment() {
    let first = derive_at(
        &params_at("/folders/first/repo"),
        &result(
            "/folders/first/repo/node_modules",
            "/folders/first/repo/node_modules/react/index.js",
        ),
        &maps("x"),
        "/folders/first/repo",
        None,
    )
    .unwrap();
    let second = derive_at(
        &params_at("/folders/second/repo"),
        &result(
            "/folders/second/repo/node_modules",
            "/folders/second/repo/node_modules/react/index.js",
        ),
        &maps("x"),
        "/folders/second/repo",
        None,
    )
    .unwrap();
    assert_eq!(first.environment, second.environment);
}

#[test]
fn a_cache_installation_keeps_a_distinct_environment() {
    let head = derive_at(
        &params_at("/folders/repo"),
        &result(
            "/folders/repo/node_modules",
            "/folders/repo/node_modules/react/index.js",
        ),
        &maps("x"),
        "/folders/repo",
        Some("/cache/namespace"),
    )
    .unwrap();
    let base = derive_at(
        &cache_params("/folders/repo", "/cache/namespace"),
        &result(
            "/cache/namespace/dependencies/entries/install/data/node_modules",
            "/cache/namespace/dependencies/entries/install/data/node_modules/react/index.js",
        ),
        &maps("x"),
        "/folders/repo",
        Some("/cache/namespace"),
    )
    .unwrap();
    assert_ne!(head.environment, base.environment);
}

#[test]
fn equivalent_cache_installations_share_one_environment() {
    let first = derive_at(
        &cache_params("/working/first/repo", "/cache/first"),
        &result(
            "/cache/first/dependencies/entries/install/data/node_modules",
            "/cache/first/dependencies/entries/install/data/node_modules/react/index.js",
        ),
        &maps("x"),
        "/working/first/repo",
        Some("/cache/first"),
    )
    .unwrap();
    let second = derive_at(
        &cache_params("/working/second/repo", "/cache/second"),
        &result(
            "/cache/second/dependencies/entries/install/data/node_modules",
            "/cache/second/dependencies/entries/install/data/node_modules/react/index.js",
        ),
        &maps("x"),
        "/working/second/repo",
        Some("/cache/second"),
    )
    .unwrap();
    assert_eq!(first.environment, second.environment);
}

#[test]
fn working_and_fallback_installations_share_one_environment() {
    let head = derive_at(
        &params("/work/repo"),
        &result(
            "/work/repo/node_modules",
            "/work/repo/node_modules/react/index.js",
        ),
        &maps("x"),
        "/work/repo",
        Some("/cache/namespace"),
    )
    .unwrap();
    let fallback = derive_at(
        &params("/cache/base"),
        &result(
            "/work/repo/node_modules",
            "/work/repo/node_modules/react/index.js",
        ),
        &maps("x"),
        "/work/repo",
        Some("/cache/namespace"),
    )
    .unwrap();
    assert_eq!(head.environment, fallback.environment);
}
