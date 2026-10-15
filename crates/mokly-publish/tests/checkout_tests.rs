//! Real Git status ignores neither submodules nor hidden untracked files.

use std::fs;

use checkout_support::{checkout, git, init};
use mokly_publish::identity::ActionsContext;
use mokly_publish::runtime::CommandCancellation;

#[path = "support/checkout.rs"]
mod checkout_support;

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
