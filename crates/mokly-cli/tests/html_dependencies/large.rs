//! Build a large immutable Git tree without materializing unrelated working files.

use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};

use mokly_git::tree::Limits;

fn git_bytes(root: &Path, args: &[&str], input: &[u8]) -> Vec<u8> {
    let mut child = Command::new("git")
        .args(args)
        .current_dir(root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    child.stdin.take().unwrap().write_all(input).unwrap();
    let output = child.wait_with_output().unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    output.stdout
}

fn object(root: &Path, args: &[&str], input: &[u8]) -> String {
    String::from_utf8(git_bytes(root, args, input))
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
    let mut entries = git_bytes(root, &["ls-tree", "-z", "HEAD"], b"");
    entries.extend_from_slice(format!("040000 tree {subtree}\tunrelated\0").as_bytes());
    let tree = object(root, &["mktree", "-z"], &entries);
    let commit = object(
        root,
        &["commit-tree", &tree, "-p", "HEAD", "-m", "large base"],
        b"",
    );
    git_bytes(root, &["update-ref", "HEAD", &commit], b"");
    git_bytes(
        root,
        &["update-ref", "refs/heads/fixture-base", &commit],
        b"",
    );
    let listed = git_bytes(
        root,
        &["ls-tree", "-r", "--name-only", &commit, "--", "unrelated"],
        b"",
    );
    assert_eq!(
        listed
            .split(|byte| *byte == b'\n')
            .filter(|line| !line.is_empty())
            .count(),
        count
    );
}
