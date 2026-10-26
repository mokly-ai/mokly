//! Publication rejects every dirty checkout variant and accepts ignored files.

use std::fs;
use std::path::Path;

use mokly_test_support::files::write;
use mokly_test_support::git::{self, git};
use mokly_test_support::publication::{self, Outputs};
use mokly_test_support::receiver::{Exchange, Options};

use super::support::mokly;

/// Make the checkout dirty in the way `name` describes, and return the reported path.
fn dirty(root: &Path, name: &str) -> String {
    let tracked = root.join("signal.txt");
    match name {
        "modified" | "staged" => {
            fs::write(&tracked, "changed").unwrap();
            if name == "staged" {
                git(root, &["add", "signal.txt"]);
            }
            "signal.txt".to_owned()
        }
        "deleted" => {
            fs::remove_file(&tracked).unwrap();
            "signal.txt".to_owned()
        }
        "renamed" => {
            git(root, &["mv", "signal.txt", "renamed.txt"]);
            "renamed.txt".to_owned()
        }
        #[cfg(unix)]
        "type" => {
            fs::remove_file(&tracked).unwrap();
            std::os::unix::fs::symlink("mokly.config.json", &tracked).unwrap();
            "signal.txt".to_owned()
        }
        "unmerged" => {
            let head = git(root, &["rev-parse", "HEAD"]);
            git(root, &["switch", "-c", "conflict"]);
            fs::write(&tracked, "branch").unwrap();
            git(root, &["commit", "-am", "branch"]);
            git(root, &["switch", "--detach", &head]);
            fs::write(&tracked, "head").unwrap();
            git(root, &["commit", "-am", "head"]);
            assert!(!git::run(root, &["merge", "conflict"]).status.success());
            "signal.txt".to_owned()
        }
        _ => {
            let expected = if name == "temporary-name" {
                ".mokly-review-notes.md"
            } else if name.contains("temporary") {
                "mokly-config-author/config.mjs"
            } else if name == "unusual-name" {
                "a \"quote\"\nname.md"
            } else {
                "new.md"
            };
            if name == "hidden-untracked" {
                git(root, &["config", "status.showUntrackedFiles", "no"]);
            }
            write(root, expected, "original");
            if name == "tracked-temporary" {
                git(root, &["add", "."]);
                git(root, &["commit", "-qm", "temporary name"]);
                fs::write(root.join(expected), "changed").unwrap();
            }
            expected.to_owned()
        }
    }
}

#[test]
fn publication_rejects_every_dirty_checkout_variant_before_allocating_output_or_requesting_plan() {
    let mut cases = vec![
        "modified",
        "staged",
        "deleted",
        "renamed",
        "untracked",
        "hidden-untracked",
        "temporary-name",
        "temporary-directory",
        "tracked-temporary",
        "unmerged",
    ];
    if cfg!(unix) {
        cases.extend(["type", "unusual-name"]);
    }
    for name in cases {
        let root = publication::fixture(false, "sha1");
        let receiver = Exchange::start(Options::default());
        let expected = dirty(root.path(), name);
        let result =
            publication::publish(&mokly(), root.path(), &receiver.endpoint, "plain", &[]).run();
        assert_eq!(result.code, Some(1), "{name}");
        assert!(result.stderr.contains("[mokly/git-uncommitted]"));
        assert!(
            result.stderr.contains(&expected.replace('\n', "\\u000a")),
            "{name}: {}",
            result.stderr
        );
        assert_eq!(result.stdout, "");
        assert!(receiver.record().bodies.is_empty());
        receiver.close();
    }
}

#[test]
fn git_ignored_output_and_ordinary_ignored_files_do_not_block_a_full_publication() {
    let root = publication::fixture(false, "sha1");
    let receiver = Exchange::start(Options::default());
    write(root.path(), ".context/notes", "ignored");
    let result =
        publication::publish(&mokly(), root.path(), &receiver.endpoint, "plain", &[]).run();
    let mut outputs = Outputs::default();
    outputs.push(publication::directory(&result.stdout));
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    assert_eq!(receiver.record().completed, 1);
    receiver.close();
}

#[test]
fn publication_reports_dirty_submodules_even_when_git_settings_hide_them() {
    let root = publication::fixture(false, "sha1");
    let submodule = publication::fixture(false, "sha1");
    let receiver = Exchange::start(Options::default());
    git(
        root.path(),
        &[
            "-c",
            "protocol.file.allow=always",
            "submodule",
            "add",
            submodule.path().to_str().unwrap(),
            "modules/demo",
        ],
    );
    git(root.path(), &["commit", "-am", "submodule"]);
    git(root.path(), &["config", "diff.ignoreSubmodules", "all"]);
    fs::write(
        root.path().join("modules/demo/signal.txt"),
        "changed submodule",
    )
    .unwrap();
    let result =
        publication::publish(&mokly(), root.path(), &receiver.endpoint, "plain", &[]).run();
    assert_eq!(result.code, Some(1));
    assert!(result.stderr.contains("[mokly/git-uncommitted]"));
    assert!(result.stderr.contains("modules/demo"));
    assert_eq!(result.stdout, "");
    assert!(receiver.record().bodies.is_empty());
    receiver.close();
}
