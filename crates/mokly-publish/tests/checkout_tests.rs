//! Real Git status ignores neither submodules nor hidden untracked files.

use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::Arc;

use mokly_git::system::SystemRunner;
use mokly_platform::processes::SystemProcessGroups;
use mokly_publish::checkout::{Checkout, GitCheckout};
use mokly_publish::hints::SystemOutputHints;
use mokly_publish::identity::ActionsContext;
use mokly_publish::runtime::CommandCancellation;

fn git(directory: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .current_dir(directory)
        .args(args)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout).unwrap()
}

fn init(directory: &Path, sha256: bool) {
    fs::create_dir_all(directory).unwrap();
    git(
        directory,
        &[
            "init",
            "-q",
            if sha256 {
                "--object-format=sha256"
            } else {
                "--object-format=sha1"
            },
        ],
    );
    git(directory, &["config", "user.name", "Mokly Test"]);
    git(directory, &["config", "user.email", "test@example.com"]);
    fs::write(directory.join("source.txt"), "source").unwrap();
    git(directory, &["add", "."]);
    git(directory, &["commit", "-qm", "test fixture"]);
}

fn checkout() -> Arc<dyn Checkout> {
    Arc::new(GitCheckout {
        hints: Arc::new(SystemOutputHints),
        runner: Arc::new(SystemRunner {
            groups: Arc::new(SystemProcessGroups),
        }),
    })
}

#[test]
fn committed_sha1_and_sha256_checkouts_support_nested_current_only_metadata() {
    for sha256 in [false, true] {
        let directory = tempfile::tempdir().unwrap();
        init(directory.path(), sha256);
        fs::create_dir(directory.path().join("nested")).unwrap();
        let checkout = checkout();
        let cancellation = CommandCancellation::default();
        let inspected = checkout
            .inspect(&directory.path().join("nested"), &[], &cancellation)
            .unwrap();
        assert!(inspected.changed_paths.is_empty());
        assert_eq!(inspected.head_sha.len(), if sha256 { 64 } else { 40 });
        let publication = checkout
            .publication(
                &inspected,
                "0.14.0",
                Some("example.com/team/project"),
                &ActionsContext::default(),
                &cancellation,
            )
            .unwrap();
        assert_eq!(publication.head_sha, inspected.head_sha);
        git(
            directory.path(),
            &["config", "status.showUntrackedFiles", "no"],
        );
        fs::write(directory.path().join("new.txt"), "new").unwrap();
        assert_eq!(
            checkout
                .inspect(directory.path(), &[], &cancellation)
                .unwrap()
                .changed_paths,
            ["new.txt"]
        );
        fs::write(directory.path().join("source.txt"), "modified").unwrap();
        git(directory.path(), &["add", "source.txt"]);
        assert_eq!(
            checkout
                .inspect(directory.path(), &[], &cancellation)
                .unwrap()
                .changed_paths,
            ["new.txt", "source.txt"]
        );
    }
}

#[test]
fn submodule_changes_count_even_when_local_settings_hide_them() {
    let directory = tempfile::tempdir().unwrap();
    let repository = directory.path().join("repository");
    let module = directory.path().join("module");
    init(&repository, false);
    init(&module, false);
    git(
        &repository,
        &[
            "-c",
            "protocol.file.allow=always",
            "submodule",
            "add",
            module.to_str().unwrap(),
            "dependency",
        ],
    );
    git(&repository, &["commit", "-qam", "add submodule"]);
    git(&repository, &["config", "diff.ignoreSubmodules", "all"]);
    git(
        &repository,
        &["config", "submodule.dependency.ignore", "all"],
    );
    fs::write(repository.join("dependency/source.txt"), "modified").unwrap();
    let cancellation = CommandCancellation::default();
    assert_eq!(
        checkout()
            .inspect(&repository, &[], &cancellation)
            .unwrap()
            .changed_paths,
        ["dependency"]
    );
}
