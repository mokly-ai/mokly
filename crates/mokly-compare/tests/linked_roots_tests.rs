//! Base Git links keep their validation failure and name the link.

use std::fs;
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::error::CatalogueError;
#[cfg(unix)]
use mokly_catalogue::working_tree::WorkingTree;
use mokly_compare::base_render::{BaseSourceFactory, GitSourceFactory};
use mokly_compare::extraction_snapshots::ProcessSnapshots;
use mokly_git::control::{SystemClock, Token};
use mokly_git::disk::SystemDisk;
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_git::system::SystemRunner;
use mokly_git::tree::Limits;
use mokly_platform::processes::SystemProcessGroups;
#[cfg(unix)]
use mokly_source_interface::tree::SourceTree;
use tempfile::TempDir;

use support::{git, git_input};

#[expect(
    dead_code,
    reason = "The shared host fixtures also support cache and install tests."
)]
mod support;

fn runner() -> Arc<SystemRunner> {
    Arc::new(SystemRunner {
        groups: Arc::new(SystemProcessGroups),
        cancellation: Arc::new(Token::default()),
        clock: Arc::new(SystemClock::default()),
    })
}

fn write(root: &Path, path: &str, body: &str) {
    let path = root.join(path);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, body).unwrap();
}

fn fixture(config: &str) -> TempDir {
    let directory = TempDir::new().unwrap();
    write(directory.path(), "tools/mokly.config.json", config);
    write(
        directory.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<h1>Home</h1>",
    );
    write(directory.path(), "vendor/ui/package.json", "{}");
    write(
        directory.path(),
        "vendor/specs/home.screen.html",
        "---\ntitle: Home\n---\n<h1>Home</h1>",
    );
    directory
}

fn commit_with_link(directory: &TempDir, path: &str, target: &str) {
    git(directory.path(), &["init", "--quiet"]);
    git(
        directory.path(),
        &["config", "user.email", "fixture@example.test"],
    );
    git(directory.path(), &["config", "user.name", "Fixture"]);
    git(directory.path(), &["add", "."]);
    let object = String::from_utf8(git_input(
        directory.path(),
        &["hash-object", "-w", "--stdin"],
        target.as_bytes(),
    ))
    .unwrap();
    let cache_info = format!("120000,{},{}", object.trim(), path);
    git(
        directory.path(),
        &["update-index", "--add", "--cacheinfo", &cache_info],
    );
    git(directory.path(), &["commit", "--quiet", "-m", "fixture"]);
}

fn base_message(config: &str, link: &str, target: &str, expected: &str) {
    let directory = fixture(config);
    commit_with_link(&directory, link, target);
    let repository = GitRepositories {
        runner: runner(),
        disk: Arc::new(SystemDisk),
    }
    .open(directory.path())
    .unwrap();
    let commit = repository.merge_base("HEAD").unwrap();
    let historical = GitSourceFactory {
        limits: Limits::default(),
        batch_bytes: 48 * 1024 * 1024,
        snapshots: Arc::new(ProcessSnapshots::default()),
    }
    .create(repository, commit, directory.path())
    .unwrap();
    let error = Loader {
        tree: historical.tree,
    }
    .load(directory.path(), Some("tools/mokly.config.json"))
    .unwrap_err();
    let display = error.to_string();
    assert_eq!(
        display,
        format!("[mokly-catalogue/config-invalid] {expected}")
    );
    let CatalogueError::Config(issue) = error else {
        panic!("expected a configuration error")
    };
    assert_eq!(issue.message, expected);
}

#[test]
fn base_git_links_name_the_unresolved_link() {
    let cases = [
        (
            r#"{"repoRoot":"..","roots":[{"dir":"../specs"}],"moduleResolution":{"packageRoots":["../packages/ui"]}}"#,
            "packages/ui",
            "../vendor/ui",
            "moduleResolution.packageRoots[0]: ../packages/ui uses the symbolic link packages/ui; name the target path instead",
        ),
        (
            r#"{"repoRoot":"..","roots":[{"dir":"../specs"}],"moduleResolution":{"packageRoots":["../link/ui"]}}"#,
            "link",
            "vendor",
            "moduleResolution.packageRoots[0]: ../link/ui uses the symbolic link link; name the target path instead",
        ),
        (
            r#"{"repoRoot":"..","roots":[{"dir":"../linked-specs"}]}"#,
            "linked-specs",
            "vendor/specs",
            "roots[0].dir: ../linked-specs uses the symbolic link linked-specs; name the target path instead",
        ),
    ];
    for (config, link, target, expected) in cases {
        base_message(config, link, target, expected);
    }
}

#[cfg(unix)]
#[test]
fn working_tree_resolves_the_same_linked_config_paths() {
    for (config, link, target) in [
        (
            r#"{"repoRoot":"..","roots":[{"dir":"../specs"}],"moduleResolution":{"packageRoots":["../packages/ui"]}}"#,
            "packages/ui",
            "../vendor/ui",
        ),
        (
            r#"{"repoRoot":"..","roots":[{"dir":"../specs"}],"moduleResolution":{"packageRoots":["../link/ui"]}}"#,
            "link",
            "vendor",
        ),
        (
            r#"{"repoRoot":"..","roots":[{"dir":"../linked-specs"}]}"#,
            "linked-specs",
            "vendor/specs",
        ),
    ] {
        let directory = fixture(config);
        let path = directory.path().join(link);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::os::unix::fs::symlink(target, path).unwrap();
        let tree: Arc<dyn SourceTree> = Arc::new(WorkingTree);
        Loader { tree }
            .load(directory.path(), Some("tools/mokly.config.json"))
            .unwrap();
    }
}
