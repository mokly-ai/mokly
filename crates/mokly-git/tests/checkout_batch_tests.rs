//! One filtered Git process converts a batch with the bytes of per-file conversion.

use std::fs;
use std::process::Command;
use std::sync::{Arc, Mutex};

use mokly_git::control::Token;
use mokly_git::disk::SystemDisk;
use mokly_git::identity::ObjectId;
use mokly_git::repository::{GitRepositories, Repositories, Repository};
use mokly_git::tree::{Entry, Limits};

#[path = "support/recording.rs"]
mod recording;
mod support;
use recording::Recorded;
use support::Fixture;

/// Converts one blob the way a checkout of `path` would, with the runner's locale.
fn per_file(fixture: &Fixture, commit: &ObjectId, entry: &Entry) -> Vec<u8> {
    let output = Command::new("git")
        .current_dir(fixture.root())
        .env("LC_ALL", "C")
        .arg(format!("--attr-source={commit}"))
        .args(["cat-file", "--filters"])
        .arg(format!("--path={}", entry.path))
        .arg(entry.object.as_str())
        .output()
        .unwrap();
    assert!(output.status.success(), "{}", entry.path);
    output.stdout
}

fn recorded(fixture: &Fixture) -> (Arc<Recorded>, Arc<dyn Repository>) {
    let recorded = Arc::new(Recorded {
        inner: support::runner(Arc::new(Token::default())),
        requests: Mutex::new(Vec::new()),
    });
    let repositories: &dyn Repositories = &GitRepositories {
        runner: recorded.clone(),
        disk: Arc::new(SystemDisk),
    };
    (recorded.clone(), repositories.open(fixture.root()).unwrap())
}

fn files(repository: &dyn Repository, commit: &ObjectId) -> Vec<Entry> {
    repository
        .list(commit, None, Limits::default())
        .unwrap()
        .into_iter()
        .filter(|entry| entry.mode.regular())
        .collect()
}

#[test]
fn batched_reads_and_extraction_equal_per_file_conversion() {
    let fixture = Fixture::new();
    fixture.write(
        ".gitattributes",
        b"* text=auto\n*.win text eol=crlf\nleading.txt text eol=crlf\nid.txt ident\n",
    );
    fixture.write("crlf.txt", b"one\r\ntwo\r\n");
    fixture.write("lines.win", b"one\ntwo\nthree\n");
    fixture.write("binary.bin", &[0, 1, 2, 0, 255, 0, 10]);
    let record = "x\0mokly-end-0 missing\0{} blob 3\0abc\0".as_bytes();
    fixture.write("records.dat", record);
    fixture.write("empty.txt", b"");
    fixture.write("inner space.win", b"inner\n");
    fixture.write(" leading.txt", b"leading\n");
    fixture.write("id.txt", b"$Id$\n");
    let base = fixture.commit();
    let repository = fixture.repository();
    let entries = files(repository.as_ref(), &base);
    let expected: Vec<_> = entries
        .iter()
        .map(|entry| per_file(&fixture, &base, entry))
        .collect();
    assert_ne!(
        expected[entries
            .iter()
            .position(|entry| entry.path.as_str() == "lines.win")
            .unwrap()]
        .len(),
        14,
        "the eol=crlf file must change length"
    );
    assert_eq!(
        repository
            .read_many(&base, &entries, Limits::default())
            .unwrap(),
        expected
    );
    let temporary = tempfile::tempdir().unwrap();
    let target = temporary.path().join("sources");
    repository
        .extract(&base, &target, Limits::default())
        .unwrap();
    for (entry, expected) in entries.iter().zip(&expected) {
        assert_eq!(
            &fs::read(target.join(entry.path.as_str())).unwrap(),
            expected,
            "{}",
            entry.path
        );
    }
}

#[test]
fn one_filtered_process_converts_each_batch_at_every_size() {
    for count in [4, 16] {
        let fixture = Fixture::new();
        fixture.write(".gitattributes", b"* text=auto eol=crlf\n");
        for index in 0..count {
            fixture.write(&format!("files/{index}.txt"), b"line\nline\n");
        }
        let base = fixture.commit();
        let (recorded, repository) = recorded(&fixture);
        let entries = files(repository.as_ref(), &base);
        assert_eq!(entries.len(), count + 1);
        recorded.requests.lock().unwrap().clear();
        let bytes = repository
            .read_many(&base, &entries, Limits::default())
            .unwrap();
        assert!(bytes[1..].iter().all(|bytes| bytes == b"line\r\nline\r\n"));
        let temporary = tempfile::tempdir().unwrap();
        repository
            .extract(&base, &temporary.path().join("sources"), Limits::default())
            .unwrap();
        let requests = recorded.requests.lock().unwrap();
        let conversions = |batch: bool| {
            requests
                .iter()
                .filter(|request| {
                    request.args.iter().any(|arg| arg == "cat-file")
                        && request.args.iter().any(|arg| arg == "--batch") == batch
                })
                .count()
        };
        assert_eq!(conversions(true), 2, "{count} files");
        assert_eq!(conversions(false), 0, "{count} files");
    }
}

#[cfg(unix)]
#[test]
fn a_failing_filter_inside_a_batch_affects_only_its_file() {
    for (name, smudge, required) in [
        ("required", "sh -c 'exit 3'", "true"),
        ("optional", "sh -c 'exit 4'", "false"),
    ] {
        let fixture = Fixture::new();
        fixture.write(".gitattributes", b"*.fail filter=fail\n");
        fixture.write("a.txt", b"a\n");
        fixture.write("x.fail", b"x\n");
        fixture.write("z.txt", b"z\n");
        let base = fixture.commit();
        fixture.git(&["config", "filter.fail.clean", "cat"]);
        fixture.git(&["config", "filter.fail.smudge", smudge]);
        fixture.git(&["config", "filter.fail.required", required]);
        let repository = fixture.repository();
        let entries = files(repository.as_ref(), &base);
        let temporary = tempfile::tempdir().unwrap();
        let target = temporary.path().join("sources");
        repository
            .extract(&base, &target, Limits::default())
            .unwrap();
        assert_eq!(fs::read(target.join("a.txt")).unwrap(), b"a\n", "{name}");
        assert_eq!(fs::read(target.join("z.txt")).unwrap(), b"z\n", "{name}");
        assert!(!target.join("x.fail").exists(), "{name}");
        let warnings = repository.conversion_warnings();
        assert_eq!(warnings.len(), 1, "{name}");
        assert_eq!(warnings[0].0, "x.fail", "{name}");
        assert!(
            matches!(
                repository.read_many(&base, &entries, Limits::default()),
                Err(mokly_git::error::Error::Conversion { .. })
            ),
            "{name}"
        );
        let readable: Vec<_> = entries
            .into_iter()
            .filter(|entry| entry.path.as_str().ends_with(".txt"))
            .collect();
        assert_eq!(
            repository
                .read_many(&base, &readable, Limits::default())
                .unwrap()
                .len(),
            2,
            "{name}"
        );
    }
}
