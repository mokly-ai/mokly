//! A local promisor fetch completes before parallel checkout conversion.

use std::collections::BTreeSet;
use std::path::Path;
use std::process::Command;
use std::sync::{Arc, Mutex};

use mokly_git::control::Token;
use mokly_git::disk::SystemDisk;
use mokly_git::error::Error;
use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_git::tree::Limits;

#[path = "support/recording.rs"]
mod recording;
#[expect(dead_code, reason = "the clone cases compose their own repository")]
mod support;
use recording::Recorded;
use support::Fixture;

fn missing_objects(clone: &Path, base: &ObjectId) -> BTreeSet<String> {
    let output = Command::new("git")
        .current_dir(clone)
        .args([
            "rev-list",
            "--objects",
            "--no-object-names",
            "--missing=print",
            base.as_str(),
        ])
        .env("GIT_NO_LAZY_FETCH", "1")
        .output()
        .unwrap();
    assert!(output.status.success());
    String::from_utf8(output.stdout)
        .unwrap()
        .lines()
        .filter_map(|line| line.strip_prefix('?').map(str::to_owned))
        .collect()
}

#[test]
fn blobless_clone_fetches_missing_base_blobs_in_one_batch() {
    let source = Fixture::new();
    source.git(&["config", "uploadpack.allowFilter", "true"]);
    source.git(&["config", "uploadpack.allowAnySHA1InWant", "true"]);
    source.write(".gitattributes", b"*.txt text eol=crlf\n-l text eol=crlf\n");
    let paths: Vec<_> = (0..8)
        .map(|index| {
            if index == 0 {
                return RepoPath::parse("-l").unwrap();
            }
            let line = if cfg!(windows) { "" } else { "\n" };
            RepoPath::parse(&format!("base/{index}[literal]{line}.txt")).unwrap()
        })
        .collect();
    for (index, path) in paths.iter().enumerate() {
        source.write(path.as_str(), format!("file {index}\n").as_bytes());
    }
    source.write("base/unrequested.txt", b"leave this blob missing\n");
    let base = source.commit();
    let unrequested = String::from_utf8(source.git(&["rev-parse", "HEAD:base/unrequested.txt"]))
        .unwrap()
        .trim()
        .to_owned();
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
    let mut missing = missing_objects(&clone, &base);
    assert!(missing.remove(&unrequested));
    assert_eq!(missing.len(), 9);
    let entries = repository.lookup(&base, &paths, Limits::default()).unwrap();
    assert_eq!(entries.len(), 8);
    std::thread::scope(|scope| {
        let workers: Vec<_> = entries
            .iter()
            .enumerate()
            .map(|(index, entry)| {
                let repository = &repository;
                let base = &base;
                scope.spawn(move || {
                    assert_eq!(
                        repository.read(base, &entry.path, 64).unwrap(),
                        format!("file {index}\r\n").as_bytes()
                    );
                })
            })
            .collect();
        for worker in workers {
            worker.join().unwrap();
        }
    });
    let requests = recorded.requests.lock().unwrap();
    let fetches: Vec<_> = requests
        .iter()
        .filter(|request| request.args.iter().any(|arg| arg == "fetch"))
        .collect();
    assert_eq!(fetches.len(), 1);
    let fetched: BTreeSet<_> = String::from_utf8(fetches[0].stdin.clone())
        .unwrap()
        .lines()
        .map(str::to_owned)
        .collect();
    assert_eq!(fetched, missing);
    assert_eq!(
        missing_objects(&clone, &base),
        BTreeSet::from([unrequested])
    );
}

#[test]
fn failed_promisor_fetch_names_recovery_command() {
    let source = Fixture::new();
    source.git(&["config", "uploadpack.allowFilter", "true"]);
    source.git(&["config", "uploadpack.allowAnySHA1InWant", "true"]);
    source.write("base.txt", b"fetch failure\n");
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
    let replacement = temporary.path().join("missing-remote");
    let output = Command::new("git")
        .args(["-C", clone.to_str().unwrap(), "remote", "set-url", "origin"])
        .arg(&replacement)
        .output()
        .unwrap();
    assert!(output.status.success());
    let repositories: &dyn Repositories = &GitRepositories {
        runner: support::runner(Arc::new(Token::default())),
        disk: Arc::new(SystemDisk),
    };
    let error = repositories
        .open(&clone)
        .unwrap()
        .read(&base, &RepoPath::parse("base.txt").unwrap(), 64)
        .unwrap_err();
    assert!(matches!(error, Error::FetchFailed { .. }), "{error:?}");
    assert!(error.to_string().contains("git fetch"));
}
