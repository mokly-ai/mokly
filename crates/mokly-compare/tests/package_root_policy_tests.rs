//! Package roots stay private in working and historical source trees.

use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_compare::base_render::{BaseSourceFactory, GitSourceFactory};
use mokly_git::control::{SystemClock, Token};
use mokly_git::disk::SystemDisk;
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_git::system::SystemRunner;
use mokly_git::tree::Limits;
use mokly_graph::policy::{FilePolicy, PublicPolicy};
use mokly_graph::public_denial::PublicDenial;
use mokly_platform::processes::SystemProcessGroups;
use mokly_source_interface::tree::SourceTree;
use tempfile::TempDir;

fn fixture() -> TempDir {
    let directory = TempDir::new().unwrap();
    for (path, body) in [
        (
            "tools/mokly.config.json",
            r#"{"repoRoot":"..","roots":[{"dir":"../specs"}],"moduleResolution":{"packageRoots":["../packages/ui"]}}"#,
        ),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<h1>Home</h1>",
        ),
        ("packages/ui/package.json", "{}"),
        ("packages/ui/private.txt", "private"),
    ] {
        let path = directory.path().join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, body).unwrap();
    }
    directory
}

fn git(directory: &Path, args: &[&str]) {
    let status = Command::new("git")
        .args(args)
        .current_dir(directory)
        .status()
        .unwrap();
    assert!(status.success(), "git {:?} failed", args);
}

fn runner() -> Arc<SystemRunner> {
    Arc::new(SystemRunner {
        groups: Arc::new(SystemProcessGroups),
        cancellation: Arc::new(Token::default()),
        clock: Arc::new(SystemClock::default()),
    })
}

#[test]
fn parent_package_root_is_private_in_current_and_historical_policy() {
    let directory = fixture();
    let current: Arc<dyn SourceTree> = Arc::new(WorkingTree);
    let current_config = Loader {
        tree: current.clone(),
    }
    .load(directory.path(), Some("tools/mokly.config.json"))
    .unwrap();
    let current_policy =
        FilePolicy::new(current, &current_config, &[], Default::default(), None).unwrap();
    assert_eq!(
        current_policy.check("packages/ui/private.txt").unwrap_err(),
        PublicDenial::Private
    );

    git(directory.path(), &["init", "--quiet"]);
    git(
        directory.path(),
        &["config", "user.email", "test@example.com"],
    );
    git(directory.path(), &["config", "user.name", "Test"]);
    git(directory.path(), &["add", "."]);
    git(directory.path(), &["commit", "--quiet", "-m", "fixture"]);

    let repositories = GitRepositories {
        runner: runner(),
        disk: Arc::new(SystemDisk),
    };
    let repository = repositories.open(directory.path()).unwrap();
    let commit = repository.merge_base("HEAD").unwrap();
    let historical = GitSourceFactory {
        limits: Limits::default(),
        batch_bytes: 48 * 1024 * 1024,
    }
    .create(repository, commit, directory.path())
    .unwrap();
    let historical_config = Loader {
        tree: historical.tree.clone(),
    }
    .load(directory.path(), Some("tools/mokly.config.json"))
    .unwrap();
    let historical_policy = FilePolicy::new(
        historical.tree,
        &historical_config,
        &[],
        Default::default(),
        None,
    )
    .unwrap();
    assert_eq!(
        historical_policy
            .check("packages/ui/private.txt")
            .unwrap_err(),
        PublicDenial::Private
    );
}
