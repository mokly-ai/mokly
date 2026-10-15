//! Real source-tree adapters prove configuration confinement and root aliases.

use std::fs;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::discovery::{Discoverer, Discovery};
use mokly_catalogue::error::CatalogueError;
use mokly_catalogue::working_tree::WorkingTree;
use tempfile::TempDir;

mod support;

#[test]
fn local_paths_resolve_from_the_config_and_package_roots_need_a_manifest() {
    let directory = TempDir::new().unwrap();
    support::write(
        directory.path(),
        "tools/catalogue.json",
        r#"{"repoRoot":"..","roots":[{"dir":"specs"}],"renderer":"renderer.tsx","postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["theme.css"]}],"moduleResolution":{"packageRoots":["ui"]}}"#,
    );
    support::write(directory.path(), "tools/specs/home.md", "# Home");
    for file in ["renderer.tsx", "postcss.mjs", "theme.css"] {
        support::write(directory.path(), &format!("tools/{file}"), "");
    }
    support::write(directory.path(), "tools/ui/package.json", "{}");
    let prepared =
        support::prepare(&directory.path().join("tools"), Some("catalogue.json")).unwrap();
    assert_eq!(prepared.model.entries[0].metadata.path, "home");
    assert!(prepared.model.sources.contains(&"tools/theme.css".into()));
    assert!(
        prepared
            .model
            .sources
            .contains(&"tools/renderer.tsx".into())
    );
    assert!(prepared.model.sources.contains(&"tools/postcss.mjs".into()));
    fs::remove_file(directory.path().join("tools/ui/package.json")).unwrap();
    let error =
        support::prepare(&directory.path().join("tools"), Some("catalogue.json")).unwrap_err();
    let CatalogueError::Config(issue) = error else {
        panic!()
    };
    assert!(issue.message.contains("packageRoots[0]"));
}

#[test]
fn default_output_and_denied_directories_are_pruned_below_each_explicit_root() {
    let directory = TempDir::new().unwrap();
    support::write(
        directory.path(),
        "mokly.config.json",
        r#"{"roots":[{"dir":"specs"},{"dir":"specs/dist","path":"explicit"}]}"#,
    );
    support::write(directory.path(), "specs/home.md", "# Home");
    support::write(directory.path(), "specs/dist/hidden.md", "# Hidden");
    support::write(directory.path(), "specs/output/old.md", "# Old");
    let tree = Arc::new(WorkingTree);
    let config = Loader { tree: tree.clone() }
        .load(directory.path(), Some("mokly.config.json"))
        .unwrap();
    let discovery: &dyn Discovery = &Discoverer { tree };
    let inventory = discovery
        .discover(&config, Some(&directory.path().join("specs/output")))
        .unwrap();
    assert_eq!(
        inventory
            .files
            .iter()
            .map(|file| file.path.as_str())
            .collect::<Vec<_>>(),
        ["specs/dist/hidden.md", "specs/home.md"]
    );
}

#[cfg(unix)]
#[test]
fn root_aliases_inside_the_repository_are_sources_but_outside_aliases_fail() {
    let directory = TempDir::new().unwrap();
    let outside = TempDir::new().unwrap();
    support::write(
        directory.path(),
        "mokly.config.json",
        r#"{"roots":[{"dir":"alias"}]}"#,
    );
    support::write(directory.path(), "actual/home.md", "# Home");
    std::os::unix::fs::symlink(
        directory.path().join("actual"),
        directory.path().join("alias"),
    )
    .unwrap();
    let prepared = support::prepare(directory.path(), Some("mokly.config.json")).unwrap();
    assert_eq!(prepared.model.entries[0].metadata.path, "home");
    assert!(prepared.model.sources.contains(&"alias/home.md".into()));
    assert!(prepared.model.sources.contains(&"actual/home.md".into()));
    fs::remove_file(directory.path().join("alias")).unwrap();
    std::os::unix::fs::symlink(outside.path(), directory.path().join("alias")).unwrap();
    let CatalogueError::Config(issue) =
        support::prepare(directory.path(), Some("mokly.config.json")).unwrap_err()
    else {
        panic!()
    };
    assert!(issue.message.contains("roots[0].dir") && issue.message.contains("outside repoRoot"));
}

#[cfg(unix)]
#[test]
fn a_repository_alias_still_produces_only_relative_source_metadata() {
    let directory = TempDir::new().unwrap();
    let holder = TempDir::new().unwrap();
    support::write(directory.path(), "mokly.config.json", "{}");
    support::write(directory.path(), "specs/home.md", "# Home");
    let alias = holder.path().join("repo");
    std::os::unix::fs::symlink(directory.path(), &alias).unwrap();
    let prepared = support::prepare(&alias, Some("mokly.config.json")).unwrap();
    assert_eq!(
        prepared.model.entries[0].metadata.source.path,
        "specs/home.md"
    );
    assert_eq!(
        prepared.model.sources,
        ["mokly.config.json", "specs/home.md"]
    );
}

#[cfg(unix)]
#[test]
fn root_physical_aliases_have_one_owner_and_local_stylesheets_cannot_escape() {
    let directory = TempDir::new().unwrap();
    let outside = TempDir::new().unwrap();
    support::write(
        directory.path(),
        "mokly.config.json",
        r#"{"roots":[{"dir":"actual"},{"dir":"alias"}]}"#,
    );
    support::write(directory.path(), "actual/home.md", "# Home");
    std::os::unix::fs::symlink(
        directory.path().join("actual"),
        directory.path().join("alias"),
    )
    .unwrap();
    let CatalogueError::Config(issue) =
        support::prepare(directory.path(), Some("mokly.config.json")).unwrap_err()
    else {
        panic!()
    };
    assert_eq!(
        issue.message,
        "file actual/home.md is matched by roots[0] and roots[1]"
    );
    support::write(outside.path(), "theme.css", "");
    std::os::unix::fs::symlink(
        outside.path().join("theme.css"),
        directory.path().join("theme.css"),
    )
    .unwrap();
    support::write(
        directory.path(),
        "mokly.config.json",
        r#"{"roots":[{"dir":"actual"}],"stylesheets":[{"match":"**","stylesheets":["theme.css"]}]}"#,
    );
    let CatalogueError::Config(issue) =
        support::prepare(directory.path(), Some("mokly.config.json")).unwrap_err()
    else {
        panic!()
    };
    assert!(issue.message.contains("stylesheets[0]") && issue.message.contains("outside repoRoot"));
}

#[cfg(unix)]
#[test]
fn configuration_aliases_keep_both_private_source_names() {
    let directory = TempDir::new().unwrap();
    support::write(directory.path(), "real-config.json", "{}");
    support::write(directory.path(), "specs/home.md", "# Home");
    std::os::unix::fs::symlink(
        directory.path().join("real-config.json"),
        directory.path().join("mokly.config.json"),
    )
    .unwrap();
    let prepared = support::prepare(directory.path(), Some("mokly.config.json")).unwrap();
    assert!(prepared.model.sources.contains(&"real-config.json".into()));
    assert!(prepared.model.sources.contains(&"mokly.config.json".into()));
}
