//! An extraction serves the converted bytes of a Git read, and Git serves the files it lacks.

use std::fs;
use std::sync::{Arc, Mutex};

use mokly_git::control::Token;
use mokly_git::disk::SystemDisk;
use mokly_git::error::Error;
use mokly_git::identity::ObjectId;
use mokly_git::repository::{GitRepositories, Repositories, Repository};
use mokly_git::tree::{Entry, Limits};

#[path = "support/recording.rs"]
mod recording;
#[expect(
    dead_code,
    reason = "these cases compose their own recording repository"
)]
mod support;
use recording::Recorded;
use support::Fixture;

struct Extracted {
    fixture: Fixture,
    base: ObjectId,
    recorded: Arc<Recorded>,
    repository: Arc<dyn Repository>,
    entries: Vec<Entry>,
    _temporary: tempfile::TempDir,
    target: std::path::PathBuf,
}

/// A converted base commit, extracted once, with a runner that records later commands.
fn extracted() -> Extracted {
    let fixture = Fixture::new();
    fixture.write(".gitattributes", b"* text=auto eol=crlf\n");
    fixture.write("a.txt", b"one\ntwo\n");
    fixture.write("dir/b.txt", b"three\n");
    fixture.write("z.txt", b"four\n");
    let base = fixture.commit();
    let recorded = Arc::new(Recorded {
        inner: support::runner(Arc::new(Token::default())),
        requests: Mutex::new(Vec::new()),
    });
    let repositories: &dyn Repositories = &GitRepositories {
        runner: recorded.clone(),
        disk: Arc::new(SystemDisk),
    };
    let repository = repositories.open(fixture.root()).unwrap();
    let entries: Vec<_> = repository
        .list(&base, None, Limits::default())
        .unwrap()
        .into_iter()
        .filter(|entry| entry.mode.regular())
        .collect();
    let temporary = tempfile::tempdir().unwrap();
    let target = temporary.path().join("sources");
    repository
        .extract(&base, &target, Limits::default())
        .unwrap();
    recorded.requests.lock().unwrap().clear();
    Extracted {
        fixture,
        base,
        recorded,
        repository,
        entries,
        _temporary: temporary,
        target,
    }
}

impl Extracted {
    /// The `--path` arguments of the conversion commands since the last call.
    fn conversions(&self) -> Vec<String> {
        let mut requests = self.recorded.requests.lock().unwrap();
        let paths = requests
            .iter()
            .filter(|request| request.args.iter().any(|arg| arg == "cat-file"))
            .map(|request| {
                request
                    .args
                    .iter()
                    .find_map(|arg| arg.to_str()?.strip_prefix("--path=").map(str::to_owned))
                    .unwrap_or_else(|| "batch".into())
            })
            .collect();
        requests.clear();
        paths
    }

    fn entry(&self, path: &str) -> &Entry {
        self.entries
            .iter()
            .find(|entry| entry.path.as_str() == path)
            .unwrap()
    }
}

#[test]
fn extracted_reads_and_digests_equal_git_and_start_no_conversion() {
    let extracted = extracted();
    let (repository, base) = (&extracted.repository, &extracted.base);
    let expected = repository
        .read_many(base, &extracted.entries, Limits::default())
        .unwrap();
    assert!(expected.iter().any(|bytes| bytes.ends_with(b"\r\n")));
    let digest = repository.digest(base, extracted.entry("a.txt")).unwrap();
    extracted.conversions();
    assert_eq!(
        repository
            .read_extracted(
                base,
                &extracted.entries,
                Limits::default(),
                &extracted.target
            )
            .unwrap(),
        expected
    );
    assert_eq!(
        repository
            .digest_extracted(base, extracted.entry("a.txt"), &extracted.target)
            .unwrap(),
        digest
    );
    assert!(extracted.conversions().is_empty());
    assert!(extracted.fixture.root().exists());
}

#[test]
fn a_file_that_the_extraction_lacks_converts_alone_through_git() {
    let extracted = extracted();
    let (repository, base) = (&extracted.repository, &extracted.base);
    let expected = repository
        .read_many(base, &extracted.entries, Limits::default())
        .unwrap();
    let digest = repository
        .digest(base, extracted.entry("dir/b.txt"))
        .unwrap();
    extracted.conversions();
    fs::remove_file(extracted.target.join("dir/b.txt")).unwrap();
    assert_eq!(
        repository
            .read_extracted(
                base,
                &extracted.entries,
                Limits::default(),
                &extracted.target
            )
            .unwrap(),
        expected
    );
    assert_eq!(extracted.conversions(), ["dir/b.txt"]);
    assert_eq!(
        repository
            .digest_extracted(base, extracted.entry("dir/b.txt"), &extracted.target)
            .unwrap(),
        digest
    );
    assert_eq!(extracted.conversions(), ["dir/b.txt"]);
}

#[cfg(unix)]
#[test]
fn a_link_in_the_extraction_never_supplies_bytes() {
    let extracted = extracted();
    let (repository, base) = (&extracted.repository, &extracted.base);
    let entry = extracted.entry("z.txt").clone();
    let expected = repository
        .read_many(base, std::slice::from_ref(&entry), Limits::default())
        .unwrap();
    extracted.conversions();
    let target = extracted.target.join("z.txt");
    fs::remove_file(&target).unwrap();
    std::os::unix::fs::symlink(extracted.target.join("a.txt"), &target).unwrap();
    assert_eq!(
        repository
            .read_extracted(
                base,
                std::slice::from_ref(&entry),
                Limits::default(),
                &extracted.target
            )
            .unwrap(),
        expected
    );
    assert_eq!(extracted.conversions(), ["z.txt"]);
}

#[test]
fn an_extracted_file_above_the_file_bound_is_an_unavailable_conversion() {
    let extracted = extracted();
    let entry = extracted.entry("z.txt").clone();
    fs::write(extracted.target.join("z.txt"), b"0123456789").unwrap();
    let limits = Limits {
        blob: 8,
        ..Limits::default()
    };
    assert!(matches!(
        extracted.repository.read_extracted(
            &extracted.base,
            std::slice::from_ref(&entry),
            limits,
            &extracted.target
        ),
        Err(Error::Conversion { path, source }) if path == "z.txt" && matches!(*source, Error::ByteLimit { limit: 8 })
    ));
    assert!(extracted.conversions().is_empty());
}
