//! Storybook folder configuration through the working source tree.

use std::fs;
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::diagnostic::Code;
use mokly_catalogue::error::{CatalogueError, Result};
use mokly_catalogue::working_tree::WorkingTree;
use tempfile::TempDir;

fn load(root: &Path, config: &str) -> Result<ResolvedConfig> {
    let directory = root.join("tools");
    fs::create_dir_all(directory.join("specs")).unwrap();
    fs::write(directory.join("mokly.config.json"), config).unwrap();
    Loader {
        tree: Arc::new(WorkingTree),
    }
    .load(&directory, Some("mokly.config.json"))
}

#[test]
fn both_storybook_field_forms_resolve_against_the_config_and_default_to_repo_root() {
    let root = TempDir::new().unwrap();
    fs::create_dir_all(root.path().join("packages/ui/.storybook")).unwrap();
    fs::create_dir_all(root.path().join("other")).unwrap();
    let config = load(
        root.path(),
        r#"{"repoRoot":"..","roots":[
        {"dir":"specs","storybook":"../packages/./ui/.storybook"},
        {"dir":"../packages/ui","storybook":{"config":"../other"}},
        {"dir":"../other"}
    ]}"#,
    )
    .unwrap();
    assert_eq!(
        config
            .roots
            .iter()
            .map(|root| root.storybook.as_str())
            .collect::<Vec<_>>(),
        ["packages/ui/.storybook", "other", ".storybook"]
    );
}

#[test]
fn missing_and_non_directory_storybook_paths_name_the_field() {
    let root = TempDir::new().unwrap();
    fs::write(root.path().join("storybook.json"), "{}").unwrap();
    for folder in ["../missing", "../storybook.json"] {
        let config = format!(
            r#"{{"repoRoot":"..","roots":[{{"dir":"specs","storybook":{{"config":"{folder}"}}}}]}}"#
        );
        let CatalogueError::Config(issue) = load(root.path(), &config).unwrap_err() else {
            panic!()
        };
        assert_eq!(issue.code, Code::ConfigInvalid);
        assert_eq!(
            issue.message,
            format!("roots[0].storybook: not an existing directory: {folder}")
        );
    }
}

#[cfg(unix)]
#[test]
fn storybook_folders_cannot_escape_lexically_or_through_a_link() {
    let root = TempDir::new().unwrap();
    let outside = TempDir::new().unwrap();
    std::os::unix::fs::symlink(outside.path(), root.path().join("linked")).unwrap();
    for folder in ["../linked", "../.."] {
        let config =
            format!(r#"{{"repoRoot":"..","roots":[{{"dir":"specs","storybook":"{folder}"}}]}}"#);
        let CatalogueError::Config(issue) = load(root.path(), &config).unwrap_err() else {
            panic!()
        };
        assert_eq!(issue.code, Code::ConfigInvalid);
        assert_eq!(
            issue.message,
            format!("roots[0].storybook: {folder} is outside repoRoot")
        );
    }
}
