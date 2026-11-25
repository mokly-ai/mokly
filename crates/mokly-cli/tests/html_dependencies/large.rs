//! Build a large immutable Git tree without materializing unrelated working files.

use std::path::Path;

use mokly_git::tree::Limits;
use mokly_test_support::git::{git, git_input};

fn object(root: &Path, args: &[&str], input: &[u8]) -> String {
    String::from_utf8(git_input(root, args, input))
        .unwrap()
        .trim()
        .into()
}

pub(super) fn add_unrelated_tree(root: &Path) {
    let blob = object(root, &["hash-object", "-w", "--stdin"], b"unrelated");
    let count = Limits::default().files + 1;
    let files = (0..count)
        .map(|index| format!("100644 blob {blob}\tfile-{index:06}\0"))
        .collect::<String>();
    let subtree = object(root, &["mktree", "-z"], files.as_bytes());
    let mut entries = git(root, &["ls-tree", "-z", "HEAD"]);
    entries.extend_from_slice(format!("040000 tree {subtree}\tunrelated\0").as_bytes());
    let tree = object(root, &["mktree", "-z"], &entries);
    let commit = object(
        root,
        &["commit-tree", &tree, "-p", "HEAD", "-m", "large base"],
        b"",
    );
    git(root, &["update-ref", "HEAD", &commit]);
    git(root, &["update-ref", "refs/heads/fixture-base", &commit]);
    let listed = git(
        root,
        &["ls-tree", "-r", "--name-only", &commit, "--", "unrelated"],
    );
    assert_eq!(
        listed
            .split(|byte| *byte == b'\n')
            .filter(|line| !line.is_empty())
            .count(),
        count
    );
}
