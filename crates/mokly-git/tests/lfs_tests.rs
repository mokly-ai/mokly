//! Git LFS checkout conversion uses a local remote without internet access.

use std::fs;
use std::process::Command;

use mokly_git::identity::RepoPath;
use mokly_git::tree::Limits;
use sha2::{Digest, Sha256};

#[expect(dead_code, reason = "the clone case composes its own repository")]
mod support;
use support::Fixture;

#[test]
fn missing_lfs_content_downloads_from_the_local_remote() {
    let source = Fixture::new();
    source.git(&["lfs", "install", "--local"]);
    source.git(&["lfs", "track", "*.lfs"]);
    let content = b"local LFS download\n";
    source.write("asset.lfs", content);
    let base = source.commit();
    let temporary = tempfile::tempdir().unwrap();
    let root = temporary.path().join("clone");
    let remote = format!("file://{}", source.root().display());
    let output = Command::new("git")
        .args(["clone", &remote])
        .arg(&root)
        .env("GIT_LFS_SKIP_SMUDGE", "1")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env(
            "GIT_CONFIG_GLOBAL",
            if cfg!(windows) { "NUL" } else { "/dev/null" },
        )
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let output = Command::new("git")
        .current_dir(&root)
        .args(["lfs", "install", "--local"])
        .output()
        .unwrap();
    assert!(output.status.success());
    let digest = Sha256::digest(content)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    let object = root.join(format!(
        ".git/lfs/objects/{}/{}/{digest}",
        &digest[..2],
        &digest[2..4]
    ));
    assert!(!object.exists());
    let repositories: &dyn mokly_git::repository::Repositories =
        &mokly_git::repository::GitRepositories {
            runner: support::runner(std::sync::Arc::new(mokly_git::control::Token::default())),
            disk: std::sync::Arc::new(mokly_git::disk::SystemDisk),
        };
    let repository = repositories.open(&root).unwrap();
    let path = RepoPath::parse("asset.lfs").unwrap();
    assert_eq!(repository.read(&base, &path, 512).unwrap(), content);
    assert_eq!(fs::read(object).unwrap(), content);
    let entries = repository
        .lookup(&base, &[path], Limits::default())
        .unwrap();
    assert_eq!(repository.digest(&base, &entries[0]).unwrap(), digest);
}
