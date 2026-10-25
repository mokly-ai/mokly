//! Checkout conversion and promisor fetch integration cases.

#[cfg(unix)]
use std::sync::Arc;
#[cfg(unix)]
use std::time::Duration;

#[cfg(unix)]
use mokly_git::control::{Clock, Token};
#[cfg(unix)]
use mokly_git::disk::SystemDisk;
#[cfg(unix)]
use mokly_git::error::Error;
use mokly_git::identity::RepoPath;
#[cfg(unix)]
use mokly_git::repository::{GitRepositories, Repositories};
#[cfg(unix)]
use mokly_git::system::SystemRunner;
use mokly_git::tree::Limits;
#[cfg(unix)]
use mokly_platform::processes::SystemProcessGroups;
use sha2::{Digest, Sha256};

use support::Fixture;

mod support;

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
            .read(&base, &RepoPath::parse("asset.lfs").unwrap(), 512)
            .unwrap(),
        b"local LFS content\n"
    );
}

#[test]
fn converted_digest_streams_files_larger_than_the_capture_limit() {
    let fixture = Fixture::new();
    let bytes = vec![7; 65 * 1024 * 1024];
    fixture.write(".gitattributes", b"large.bin -text\n");
    fixture.write("large.bin", &bytes);
    let base = fixture.commit();
    let entry = fixture
        .repository()
        .list(&base, None, Limits::default())
        .unwrap()
        .into_iter()
        .find(|entry| entry.path.as_str() == "large.bin")
        .unwrap();
    let expected = Sha256::digest(&bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();

    assert_eq!(
        fixture.repository().digest(&base, &entry).unwrap(),
        expected
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

    let error = fixture
        .repository()
        .read(&base, &RepoPath::parse("value.filtered").unwrap(), 64)
        .unwrap_err();
    assert!(matches!(error, Error::Conversion { .. }));
}

#[cfg(unix)]
#[test]
fn an_optional_checkout_filter_failure_does_not_return_pointer_bytes() {
    let fixture = Fixture::new();
    fixture.git(&["config", "filter.optional.clean", "cat"]);
    fixture.git(&["config", "filter.optional.smudge", "sh -c 'exit 42'"]);
    fixture.git(&["config", "filter.optional.required", "false"]);
    fixture.write(".gitattributes", b"*.optional filter=optional\n");
    fixture.write("value.optional", b"source\n");
    let base = fixture.commit();

    let error = fixture
        .repository()
        .read(&base, &RepoPath::parse("value.optional").unwrap(), 64)
        .unwrap_err();
    assert!(matches!(error, Error::Conversion { .. }));
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
    let error = repositories
        .open(fixture.root())
        .unwrap()
        .read(&base, &RepoPath::parse("value.wait").unwrap(), 64)
        .unwrap_err();
    assert!(
        matches!(error, Error::Conversion { source, .. } if matches!(*source, Error::CheckoutTimeout))
    );
}

#[cfg(unix)]
#[derive(Default)]
struct FastClock(std::sync::atomic::AtomicU64);

#[cfg(unix)]
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

#[test]
fn base_attributes_override_staged_and_working_attributes() {
    let fixture = Fixture::new();
    fixture.write(".gitattributes", b"*.txt text eol=crlf\n");
    fixture.write("notes.txt", b"base\n");
    let base = fixture.commit();
    fixture.write(".gitattributes", b"*.txt -text\n");
    fixture.write("notes.txt", b"staged\n");
    fixture.git(&["add", "-A"]);
    fixture.write("notes.txt", b"working\n");
    let staged = fixture.git(&["write-tree"]);
    assert_eq!(
        fixture
            .repository()
            .read(&base, &RepoPath::parse("notes.txt").unwrap(), 32)
            .unwrap(),
        b"base\r\n"
    );
    assert_eq!(fixture.git(&["write-tree"]), staged);
    assert_eq!(
        std::fs::read(fixture.root().join("notes.txt")).unwrap(),
        b"working\n"
    );
}
