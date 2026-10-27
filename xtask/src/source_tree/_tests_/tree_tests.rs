//! The fingerprint of real working trees: contents, modes, paths,
//! deletions, ignore rules, links, and nested repositories.

use std::ffi::OsStr;
use std::fs;
use std::os::unix::ffi::OsStrExt;
use std::os::unix::fs::{PermissionsExt, symlink};
use std::path::Path;

use crate::source_tree::command::{SourceTreeRequest, source_tree_output};
use crate::source_tree::error::Error;
use crate::source_tree::system::SystemTree;

use super::tree_fixture::TreeFixture;

fn chmod(file: &Path, mode: u32) {
    fs::set_permissions(file, fs::Permissions::from_mode(mode)).unwrap();
}

#[test]
fn working_tree_bytes_executable_mode_path_and_deletion_each_change_the_digest() {
    let fixture = TreeFixture::committed();
    let file = fixture.path("file.txt");
    let baseline = fixture.fingerprint().unwrap();
    fs::write(&file, "changed\n").unwrap();
    assert_ne!(fixture.fingerprint().unwrap(), baseline);
    fs::write(&file, "hello\n").unwrap();
    assert_eq!(fixture.fingerprint().unwrap(), baseline);
    chmod(&file, 0o755);
    assert_ne!(fixture.fingerprint().unwrap(), baseline);
    chmod(&file, 0o644);
    fs::rename(&file, fixture.path("renamed.txt")).unwrap();
    assert_ne!(fixture.fingerprint().unwrap(), baseline);
    fs::rename(fixture.path("renamed.txt"), &file).unwrap();
    fs::remove_file(&file).unwrap();
    let deleted = fixture.fingerprint().unwrap();
    assert_ne!(deleted, baseline);
    fixture.git(&["add", "--update"]);
    assert_eq!(fixture.fingerprint().unwrap(), deleted);
}

#[test]
fn non_ignored_untracked_files_participate_while_ignored_files_and_git_metadata_do_not() {
    let fixture = TreeFixture::committed();
    fs::write(fixture.path(".gitignore"), "ignored/\n").unwrap();
    fixture.git(&["add", ".gitignore"]);
    let baseline = fixture.fingerprint().unwrap();
    fs::create_dir(fixture.path("ignored")).unwrap();
    fs::write(fixture.path("ignored/output"), "ignored").unwrap();
    fs::write(fixture.path(".git/extra-metadata"), "metadata").unwrap();
    assert_eq!(fixture.fingerprint().unwrap(), baseline);
    fs::write(fixture.path("untracked.txt"), "included").unwrap();
    assert_ne!(fixture.fingerprint().unwrap(), baseline);
    fs::remove_file(fixture.path("untracked.txt")).unwrap();
    fs::write(fixture.path(".gitignore"), "ignored/\nfile.txt\n").unwrap();
    let ignored_tracked = fixture.fingerprint().unwrap();
    fs::write(fixture.path("file.txt"), "still tracked").unwrap();
    assert_ne!(fixture.fingerprint().unwrap(), ignored_tracked);
}

#[test]
fn symbolic_links_hash_their_target_bytes_and_retain_broken_links() {
    let fixture = TreeFixture::committed();
    let file = fixture.path("file.txt");
    let ignored = fixture.path("ignored");
    fs::write(fixture.path(".gitignore"), "ignored\n").unwrap();
    fs::write(&ignored, "target content").unwrap();
    fs::remove_file(&file).unwrap();
    symlink("ignored", &file).unwrap();
    let first = fixture.fingerprint().unwrap();
    fs::write(&ignored, "different target content").unwrap();
    assert_eq!(fixture.fingerprint().unwrap(), first);
    fs::remove_file(&ignored).unwrap();
    assert_eq!(fixture.fingerprint().unwrap(), first);
    fs::remove_file(&file).unwrap();
    symlink("another-target", &file).unwrap();
    assert_ne!(fixture.fingerprint().unwrap(), first);
}

#[test]
fn submodule_index_entries_fail_even_when_their_working_tree_path_is_absent() {
    let fixture = TreeFixture::committed();
    let head = fixture.git(&["rev-parse", "HEAD"]);
    fixture.git(&[
        "update-index",
        "--add",
        "--cacheinfo",
        &format!("160000,{head},module"),
    ]);
    assert!(matches!(fixture.fingerprint(), Err(Error::Submodule)));
}

#[test]
fn a_nested_repository_in_place_of_a_tracked_file_fails_rather_than_disappearing() {
    let fixture = TreeFixture::committed();
    fs::remove_file(fixture.path("file.txt")).unwrap();
    fixture.nested("file.txt");
    let error = fixture.fingerprint().unwrap_err();
    assert!(error.to_string().contains("file type"), "{error}");
}

#[test]
fn paths_with_whitespace_and_non_ascii_names_retain_their_original_bytes() {
    let fixture = TreeFixture::committed();
    let name = if cfg!(target_os = "linux") {
        OsStr::from_bytes(&[0xff])
    } else {
        OsStr::new("é")
    };
    let file = fixture.root().join(name);
    fs::write(&file, "one").unwrap();
    fs::write(fixture.path("space and\nnewline.txt"), "two").unwrap();
    let first = fixture.fingerprint().unwrap();
    fs::write(&file, "changed").unwrap();
    assert_ne!(fixture.fingerprint().unwrap(), first);
}

#[test]
fn an_unpushed_commit_and_the_same_uncommitted_change_have_the_same_fingerprint() {
    let fixture = TreeFixture::committed();
    let origin = fixture.outside().join("origin.git");
    let peer = fixture.outside().join("peer");
    fixture.git_in(
        fixture.outside(),
        &[
            "init",
            "-q",
            "--bare",
            "--initial-branch=main",
            &origin.to_string_lossy(),
        ],
    );
    fixture.git(&["remote", "add", "origin", &origin.to_string_lossy()]);
    fixture.git(&["push", "-q", "--set-upstream", "origin", "main"]);
    fixture.git_in(
        fixture.outside(),
        &[
            "clone",
            "-q",
            &origin.to_string_lossy(),
            &peer.to_string_lossy(),
        ],
    );
    fs::write(fixture.path("file.txt"), "same change\n").unwrap();
    fs::write(peer.join("file.txt"), "same change\n").unwrap();
    let uncommitted = crate::source_tree::scan::read_source_tree(&SystemTree, &peer)
        .unwrap()
        .to_string();
    fixture.git(&["add", "file.txt"]);
    fixture.git(&["commit", "-q", "-m", "test: unpushed change"]);
    assert_eq!(
        fixture.git(&[
            "for-each-ref",
            "--contains",
            "HEAD",
            "--format=%(refname)",
            "refs/remotes/origin/",
        ]),
        ""
    );
    assert_ne!(
        fixture.git(&["rev-parse", "HEAD"]),
        fixture.git(&["rev-parse", "origin/main"])
    );
    assert_eq!(fixture.fingerprint().unwrap(), uncommitted);
}

#[test]
fn a_nested_worktree_error_names_its_relative_path_and_the_recovery_hint() {
    let fixture = TreeFixture::committed();
    fixture.git(&["worktree", "add", "-q", "--detach", "nested/worker", "HEAD"]);
    assert_eq!(
        fixture.fingerprint().unwrap_err().to_string(),
        "[xtask/source-tree] source-tree fingerprint found an unsupported file type at \"nested/worker/\"; ignore or remove a nested repository or worktree"
    );
}

#[test]
fn the_repository_ignore_rule_excludes_claude_worktrees_from_the_fingerprint() {
    let fixture = TreeFixture::committed();
    let ignore_rules = Path::new(env!("CARGO_MANIFEST_DIR")).join("../.gitignore");
    fs::copy(ignore_rules, fixture.path(".gitignore")).unwrap();
    fixture.git(&["add", ".gitignore"]);
    let baseline = fixture.fingerprint().unwrap();
    fixture.git(&[
        "worktree",
        "add",
        "-q",
        "--detach",
        ".claude/worktrees/worker",
        "HEAD",
    ]);
    assert_eq!(fixture.fingerprint().unwrap(), baseline);
    assert_eq!(
        fixture.git(&["check-ignore", ".claude/worktrees/worker/"]),
        ".claude/worktrees/worker/"
    );
}

#[test]
fn the_command_prints_the_fingerprint_and_the_real_head() {
    let fixture = TreeFixture::committed();
    let fingerprint = fixture.fingerprint().unwrap();
    let head = fixture.git(&["rev-parse", "HEAD"]);
    let request = SourceTreeRequest {
        expected: Some(
            crate::source_tree::records::SourceFingerprint::parse(&fingerprint).unwrap(),
        ),
        print_head: true,
    };
    assert_eq!(
        source_tree_output(&SystemTree, &fixture.root(), &request).unwrap(),
        format!("{fingerprint}\n{head}\n")
    );
}
