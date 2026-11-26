//! In a partial clone, a listing without a blob needs no second, sized listing.

use std::process::Command;
use std::sync::{Arc, Mutex};

use mokly_git::control::Token;
use mokly_git::disk::SystemDisk;
use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::repository::{GitRepositories, Repositories, Repository};
use mokly_git::tree::{Limits, Mode};

#[path = "support/recording.rs"]
mod recording;
#[expect(dead_code, reason = "the clone case composes its own repository")]
mod support;
use recording::Recorded;
use support::Fixture;

/// A blobless clone of a commit with `styles/site.css`, and a recording repository
/// that opens it.
fn blobless() -> (
    Fixture,
    tempfile::TempDir,
    ObjectId,
    Arc<Recorded>,
    Arc<dyn Repository>,
) {
    let source = Fixture::new();
    source.git(&["config", "uploadpack.allowFilter", "true"]);
    source.git(&["config", "uploadpack.allowAnySHA1InWant", "true"]);
    source.write("styles/site.css", b"a {}\n");
    let base = source.commit();
    let temporary = tempfile::tempdir().unwrap();
    let clone = temporary.path().join("blobless");
    let remote_path = source.root().to_string_lossy().replace('\\', "/");
    let remote = if cfg!(windows) {
        format!("file:///{remote_path}")
    } else {
        format!("file://{remote_path}")
    };
    let output = Command::new("git")
        .args(["clone", "--filter=blob:none", "--no-checkout", &remote])
        .arg(&clone)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .output()
        .unwrap();
    assert!(output.status.success());
    let recorded = Arc::new(Recorded {
        inner: support::runner(Arc::new(Token::default())),
        requests: Mutex::new(Vec::new()),
    });
    let repositories: &dyn Repositories = &GitRepositories {
        runner: recorded.clone(),
        disk: Arc::new(SystemDisk),
    };
    let repository = repositories.open(&clone).unwrap();
    (source, temporary, base, recorded, repository)
}

/// The number of `ls-tree` requests since the last call, which clears the record.
fn tree_listings(recorded: &Recorded) -> usize {
    let mut requests = recorded.requests.lock().unwrap();
    let count = requests
        .iter()
        .filter(|request| request.args.iter().any(|arg| arg == "ls-tree"))
        .count();
    requests.clear();
    count
}

#[test]
fn a_partial_clone_lists_a_result_without_a_blob_once() {
    let (_source, _clone, base, recorded, repository) = blobless();
    recorded.requests.lock().unwrap().clear();
    let directory = RepoPath::parse("styles").unwrap();
    let absent = RepoPath::parse("missing.css").unwrap();

    let entries = repository
        .lookup(&base, std::slice::from_ref(&directory), Limits::default())
        .unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].mode, Mode::Directory);
    // The lookup, then the root attribute lookup of the missing-object walk.
    assert_eq!(tree_listings(&recorded), 2, "directory lookup");

    let entries = repository
        .lookup(&base, std::slice::from_ref(&absent), Limits::default())
        .unwrap();
    assert!(entries.is_empty());
    assert_eq!(tree_listings(&recorded), 1, "absent path lookup");

    let entries = repository
        .list(&base, Some(&absent), Limits::default())
        .unwrap();
    assert!(entries.is_empty());
    assert_eq!(tree_listings(&recorded), 1, "absent root listing");

    let entries = repository
        .lookup(
            &base,
            &[RepoPath::parse("styles/site.css").unwrap()],
            Limits::default(),
        )
        .unwrap();
    assert_eq!(entries[0].size, 5, "a blob still takes its size");
}
