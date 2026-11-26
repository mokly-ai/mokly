//! Exact lookups keep their entries and answer paths below a missing directory without Git.

use std::sync::{Arc, Mutex};

use mokly_git::control::Token;
use mokly_git::disk::SystemDisk;
use mokly_git::identity::{ObjectId, RepoPath};
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

struct Session {
    _fixture: Fixture,
    commit: ObjectId,
    recorded: Arc<Recorded>,
    repository: Arc<dyn Repository>,
}

/// A commit with a nested directory, a file named like a directory, and no
/// `node_modules`, read through a runner that records each Git command.
fn session() -> Session {
    let fixture = Fixture::new();
    fixture.write("dir/other.css", b"o\n");
    fixture.write("dir/sub/x.css", b"x\n");
    fixture.write("dir/sub/y.css", b"y\n");
    fixture.write("vendor", b"v\n");
    let commit = fixture.commit();
    let recorded = Arc::new(Recorded {
        inner: support::runner(Arc::new(Token::default())),
        requests: Mutex::new(Vec::new()),
    });
    let repositories: &dyn Repositories = &GitRepositories {
        runner: recorded.clone(),
        disk: Arc::new(SystemDisk),
    };
    let repository = repositories.open(fixture.root()).unwrap();
    Session {
        _fixture: fixture,
        commit,
        recorded,
        repository,
    }
}

impl Session {
    fn lookup(&self, paths: &[&str]) -> Vec<String> {
        let paths: Vec<_> = paths
            .iter()
            .map(|path| RepoPath::parse(path).unwrap())
            .collect();
        self.repository
            .lookup(&self.commit, &paths, Limits::default())
            .unwrap()
            .iter()
            .map(|entry: &Entry| entry.path.to_string())
            .collect()
    }

    fn tree_commands(&self) -> usize {
        self.recorded
            .requests
            .lock()
            .unwrap()
            .iter()
            .filter(|request| request.args.iter().any(|arg| arg == "ls-tree"))
            .count()
    }
}

/// The tree commands of `count` lookups below a missing directory and below a file.
fn lookups_below_missing_directories(count: usize) -> usize {
    let session = session();
    for index in 0..count {
        assert!(
            session
                .lookup(&[&format!("node_modules/package-{index}/index.js")])
                .is_empty()
        );
        assert!(session.lookup(&[&format!("vendor/{index}.js")]).is_empty());
    }
    assert_eq!(session.lookup(&["vendor"]), ["vendor"]);
    session.tree_commands()
}

#[test]
fn paths_below_a_missing_directory_or_a_file_start_one_tree_command() {
    let small = lookups_below_missing_directories(4);
    let large = lookups_below_missing_directories(16);
    assert!(small > 0);
    assert_eq!(small, large);
}

#[test]
fn a_lookup_keeps_the_entries_of_its_exact_listing() {
    let session = session();
    assert_eq!(session.lookup(&["dir/sub/x.css"]), ["dir/sub/x.css"]);
    assert_eq!(session.lookup(&["dir"]), ["dir"]);
    assert_eq!(
        session.lookup(&["dir", "dir/sub/x.css"]),
        ["dir/other.css", "dir/sub/x.css", "dir/sub/y.css"]
    );
    assert_eq!(session.lookup(&["dir/missing/z.css"]), Vec::<String>::new());
    assert_eq!(session.lookup(&["dir/sub/x.css"]), ["dir/sub/x.css"]);
}
