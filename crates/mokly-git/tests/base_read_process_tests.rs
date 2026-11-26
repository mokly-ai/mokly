//! A base lookup and a base read each start one listing process, and a missing object keeps its error.

use std::fs;
use std::sync::{Arc, Mutex};

use mokly_git::command::Request;
use mokly_git::control::Token;
use mokly_git::disk::SystemDisk;
use mokly_git::error::Error;
use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::repository::{GitRepositories, Repositories, Repository};
use mokly_git::tree::Limits;

#[path = "support/recording.rs"]
mod recording;
mod support;
use recording::Recorded;
use support::Fixture;

fn recorded(fixture: &Fixture) -> (Arc<Recorded>, Arc<dyn Repository>) {
    let recorded = Arc::new(Recorded {
        inner: support::runner(Arc::new(Token::default())),
        requests: Mutex::new(Vec::new()),
    });
    let repositories: &dyn Repositories = &GitRepositories {
        runner: recorded.clone(),
        disk: Arc::new(SystemDisk),
    };
    let repository = repositories.open(fixture.root()).unwrap();
    recorded.requests.lock().unwrap().clear();
    (recorded, repository)
}

/// The Git subcommand of each request, after the global options.
fn commands(requests: &[Request]) -> Vec<String> {
    requests
        .iter()
        .map(|request| {
            request
                .args
                .iter()
                .map(|argument| argument.to_string_lossy().into_owned())
                .find(|argument| !argument.starts_with('-'))
                .unwrap()
        })
        .collect()
}

/// A commit with attribute files at the root and in a parent directory, and
/// `count` stylesheets in a nested directory.
fn stylesheets(count: usize) -> (Fixture, ObjectId, Vec<RepoPath>) {
    let fixture = Fixture::new();
    fixture.write(".gitattributes", b"*.css text eol=crlf\n");
    fixture.write("styles/.gitattributes", b"*.png binary\n");
    let paths: Vec<_> = (0..count)
        .map(|index| {
            let path = format!("styles/site/page-{index:02}.css");
            fixture.write(&path, format!("a{index}\n").as_bytes());
            RepoPath::parse(&path).unwrap()
        })
        .collect();
    let commit = fixture.commit();
    (fixture, commit, paths)
}

#[test]
fn a_base_lookup_and_read_start_one_listing_each_and_one_conversion() {
    for count in [1, 4, 16] {
        let (fixture, commit, paths) = stylesheets(count);
        let (recorded, repository) = recorded(&fixture);
        let entries = repository
            .lookup(&commit, &paths, Limits::default())
            .unwrap();
        assert_eq!(entries.len(), count, "{count} files");
        let bytes = repository
            .read_many(&commit, &entries, Limits::default())
            .unwrap();
        assert_eq!(bytes[0], b"a0\r\n", "{count} files");
        assert_eq!(bytes[count - 1], format!("a{}\r\n", count - 1).as_bytes());
        assert_eq!(
            commands(&recorded.requests.lock().unwrap()),
            ["ls-tree", "ls-tree", "cat-file"],
            "{count} files"
        );
    }
}

/// Removes the loose object of `object`, as a pruned or damaged store would.
fn remove(fixture: &Fixture, object: &str) {
    let (directory, file) = object.split_at(2);
    fs::remove_file(
        fixture
            .root()
            .join(".git/objects")
            .join(directory)
            .join(file),
    )
    .unwrap();
}

#[test]
fn a_missing_attribute_or_source_blob_keeps_the_missing_object_error() {
    for removed in ["styles/.gitattributes", "styles/site/page-00.css"] {
        let (fixture, commit, paths) = stylesheets(1);
        let repository = fixture.repository();
        let entries = repository
            .lookup(&commit, &paths, Limits::default())
            .unwrap();
        let object = String::from_utf8(fixture.git(&["rev-parse", &format!("{commit}:{removed}")]))
            .unwrap()
            .trim()
            .to_owned();
        remove(&fixture, &object);
        let looked_up = repository.lookup(&commit, &paths, Limits::default());
        assert!(
            matches!(&looked_up, Err(Error::MissingObject { object: missing }) if *missing == object),
            "{removed}: {looked_up:?}"
        );
        let read = repository.read_many(&commit, &entries, Limits::default());
        assert!(
            matches!(&read, Err(Error::MissingObject { object: missing }) if *missing == object),
            "{removed}: {read:?}"
        );
    }
}
