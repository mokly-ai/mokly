//! Real listing requests keep exact output without running a configured monitor.

use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::sync::{Arc, Mutex};

use mokly_git::changes::{Change, ChangedPath, Kind};
use mokly_git::control::Token;
use mokly_git::disk::SystemDisk;
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_test_support::git::git;

#[path = "support/recording.rs"]
mod recording;
#[expect(
    dead_code,
    reason = "the listing fixture composes its own recorded repository"
)]
mod support;

use recording::Recorded;
use support::Fixture;

#[test]
fn file_listings_keep_output_and_do_not_invoke_configured_fsmonitor() {
    let fixture = Fixture::new();
    fixture.write(".gitignore", b"ignored\n");
    fixture.write("tracked.screen.html", b"base");
    let base = fixture.commit();
    fixture.write("untracked.screen.html", b"new");
    fixture.write("ignored", b"private");
    let recorded = Arc::new(Recorded {
        inner: support::runner(Arc::new(Token::default())),
        requests: Mutex::new(Vec::new()),
    });
    let repositories: &dyn Repositories = &GitRepositories {
        runner: recorded.clone(),
        disk: Arc::new(SystemDisk),
    };
    let repository = repositories.open(fixture.root()).unwrap();
    assert_eq!(
        repository
            .working_paths()
            .unwrap()
            .iter()
            .map(|path| path.as_str())
            .collect::<Vec<_>>(),
        [".gitignore", "tracked.screen.html", "untracked.screen.html"]
    );
    assert_eq!(
        repository.changed_paths(&base).unwrap(),
        [Change {
            path: ChangedPath::parse("untracked.screen.html").unwrap(),
            kind: Kind::Added,
        }]
    );
    let requests: Vec<_> = recorded
        .requests
        .lock()
        .unwrap()
        .iter()
        .filter(|request| request.args.iter().any(|arg| arg == "ls-files"))
        .cloned()
        .collect();
    assert_eq!(requests.len(), 2);
    fixture.write(
        ".git/hooks/mokly-fsmonitor",
        b"#!/bin/sh\nprintf called > .git/mokly-fsmonitor-marker\nprintf '%s\\000' \"$2\"\n",
    );
    let hook = fixture.root().join(".git/hooks/mokly-fsmonitor");
    #[cfg(unix)]
    fs::set_permissions(&hook, fs::Permissions::from_mode(0o755)).unwrap();
    git(
        fixture.root(),
        &[
            "config",
            "core.fsmonitor",
            &hook.to_string_lossy().replace('\\', "/"),
        ],
    );
    git(
        fixture.root(),
        &["config", "core.fsmonitorHookVersion", "2"],
    );
    let marker = fixture.root().join(".git/mokly-fsmonitor-marker");
    for (request, args) in requests.iter().zip([
        [
            "ls-files",
            "-z",
            "--cached",
            "--others",
            "--exclude-standard",
        ]
        .as_slice(),
        ["ls-files", "--others", "--exclude-standard", "-z"].as_slice(),
    ]) {
        let before = git(fixture.root(), args);
        assert_eq!(fs::read(&marker).unwrap(), b"called");
        fs::remove_file(&marker).unwrap();
        assert_eq!(recorded.inner.run(request).unwrap().stdout, before);
        assert!(!marker.exists(), "listing invoked fsmonitor: {request:?}");
    }
}
