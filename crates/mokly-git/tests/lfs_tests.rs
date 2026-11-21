//! Git LFS checkout conversion uses a local remote without internet access.

use std::fs;

use mokly_git::identity::RepoPath;
use mokly_git::tree::Limits;
use mokly_test_support::git::{command, git, run};
use sha2::{Digest, Sha256};

#[expect(dead_code, reason = "the clone case composes its own repository")]
mod support;
use support::Fixture;

#[test]
fn missing_lfs_content_downloads_from_the_local_remote() {
    let source = Fixture::new();
    git(source.root(), &["lfs", "install", "--local"]);
    git(source.root(), &["lfs", "track", "*.lfs"]);
    let content = b"local LFS download\n";
    source.write("asset.lfs", content);
    let base = source.commit();
    let temporary = tempfile::tempdir().unwrap();
    let root = temporary.path().join("clone");
    let remote_path = source.root().to_string_lossy().replace('\\', "/");
    let remote = if cfg!(windows) {
        format!("file:///{remote_path}")
    } else {
        format!("file://{remote_path}")
    };
    run(command()
        .args(["clone", &remote])
        .arg(&root)
        .env("GIT_LFS_SKIP_SMUDGE", "1"));
    git(&root, &["lfs", "install", "--local"]);
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
