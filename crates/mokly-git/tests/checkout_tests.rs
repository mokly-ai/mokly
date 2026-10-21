//! Checkout conversion and promisor fetch integration cases.

use std::process::Command;
use std::sync::Arc;
use std::time::Duration;

use mokly_git::control::{Clock, Token};
use mokly_git::disk::SystemDisk;
use mokly_git::error::Error;
use mokly_git::identity::RepoPath;
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_git::system::SystemRunner;
use mokly_git::tree::Limits;
use mokly_platform::processes::SystemProcessGroups;

use support::Fixture;

mod support;

#[test]
fn blobless_clone_fetches_missing_base_blobs_in_one_batch() {
    let source = Fixture::new();
    source.git(&["config", "uploadpack.allowFilter", "true"]);
    source.git(&["config", "uploadpack.allowAnySHA1InWant", "true"]);
    source.write("base.txt", b"fetched from the local promisor\n");
    source.write("other.txt", b"a second fetched blob\n");
    let base = source.commit();
    let temporary = tempfile::tempdir().unwrap();
    let clone = temporary.path().join("blobless");
    let remote = format!("file://{}", source.root().display());
    let output = Command::new("git")
        .args(["clone", "--filter=blob:none", "--no-checkout", &remote])
        .arg(&clone)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .output()
        .unwrap();
    assert!(output.status.success());
    let repositories: &dyn Repositories = &GitRepositories {
        runner: support::runner(Arc::new(Token::default())),
        disk: Arc::new(SystemDisk),
    };
    let repository = repositories.open(&clone).unwrap();
    let entries = repository
        .lookup(
            &base,
            &[
                RepoPath::parse("base.txt").unwrap(),
                RepoPath::parse("other.txt").unwrap(),
            ],
            Limits::default(),
        )
        .unwrap();
    assert_eq!(
        repository
            .read_many(
                &base,
                &entries,
                Limits {
                    bytes: 128,
                    blob: 128,
                    ..Limits::default()
                },
            )
            .unwrap(),
        [
            b"fetched from the local promisor\n".to_vec(),
            b"a second fetched blob\n".to_vec()
        ]
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
    let remote = format!("file://{}", source.root().display());
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

#[test]
fn base_reads_apply_the_commit_line_ending_rule() {
    let fixture = Fixture::new();
    fixture.write(".gitattributes", b"*.txt text eol=crlf\n");
    fixture.write("notes.txt", b"one\ntwo\n");
    let base = fixture.commit();

    assert_eq!(
        fixture
            .repository()
            .read(&base, &RepoPath::parse("notes.txt").unwrap(), 32)
            .unwrap(),
        b"one\r\ntwo\r\n"
    );
}

#[test]
fn base_reads_smudge_local_lfs_objects() {
    let fixture = Fixture::new();
    fixture.git(&["lfs", "install", "--local"]);
    fixture.git(&["lfs", "track", "*.lfs"]);
    fixture.write("asset.lfs", b"local LFS content\n");
    let base = fixture.commit();

    assert_eq!(
        fixture
            .repository()
            .read(&base, &RepoPath::parse("asset.lfs").unwrap(), 64)
            .unwrap(),
        b"local LFS content\n"
    );
}

#[cfg(unix)]
#[test]
fn a_failed_checkout_filter_does_not_return_pointer_bytes() {
    let fixture = Fixture::new();
    fixture.git(&["config", "filter.fail.clean", "cat"]);
    fixture.git(&["config", "filter.fail.smudge", "sh -c 'exit 42'"]);
    fixture.git(&["config", "filter.fail.required", "true"]);
    fixture.write(".gitattributes", b"*.filtered filter=fail\n");
    fixture.write("value.filtered", b"source\n");
    let base = fixture.commit();

    assert!(
        fixture
            .repository()
            .read(&base, &RepoPath::parse("value.filtered").unwrap(), 64)
            .is_err()
    );
}

#[cfg(unix)]
#[test]
fn a_hanging_checkout_filter_is_bounded() {
    let fixture = Fixture::new();
    fixture.git(&["config", "filter.wait.clean", "cat"]);
    fixture.git(&["config", "filter.wait.smudge", "sh -c 'sleep 60'"]);
    fixture.git(&["config", "filter.wait.required", "true"]);
    fixture.write(".gitattributes", b"*.wait filter=wait\n");
    fixture.write("value.wait", b"source\n");
    let base = fixture.commit();
    let repositories: &dyn Repositories = &GitRepositories {
        runner: Arc::new(SystemRunner {
            groups: Arc::new(SystemProcessGroups),
            cancellation: Arc::new(Token::default()),
            clock: Arc::new(FastClock::default()),
        }),
        disk: Arc::new(SystemDisk),
    };
    assert!(
        repositories
            .open(fixture.root())
            .unwrap()
            .read(&base, &RepoPath::parse("value.wait").unwrap(), 64)
            .is_err()
    );
}

#[derive(Default)]
struct FastClock(std::sync::atomic::AtomicU64);

impl Clock for FastClock {
    fn now(&self) -> Duration {
        Duration::from_millis(self.0.load(std::sync::atomic::Ordering::Relaxed))
    }

    fn pause(&self, duration: Duration) {
        self.0.fetch_add(
            duration.as_millis() as u64,
            std::sync::atomic::Ordering::Relaxed,
        );
    }
}
