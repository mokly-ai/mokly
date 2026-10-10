//! Isolated real Git repositories with captured shell-free process requests.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;

use unimock::{MockFn, Unimock, matching};

use crate::remote::adapter_support::TestDirectory;
use crate::remote::contracts::{ClockSleepMock, InterruptRequestedMock, Output};
use crate::remote::error::Result;
use crate::remote::git_identity::CommitSha;
use crate::remote::git_test_runner::IsolatedGit;
use crate::remote::process::{Process, Request, SystemProcess};
use crate::remote::scripts::SystemScripts;

/// Non-secret request fields used to check actual adapter behavior.
#[derive(Clone, Debug)]
pub(crate) struct CapturedRequest {
    /// Separate argument values.
    pub(crate) args: Vec<String>,
    /// Local process directory.
    pub(crate) cwd: PathBuf,
    /// Request-specific index override.
    pub(crate) git_index: Option<PathBuf>,
    /// Whether an interrupt can kill this request.
    pub(crate) cancellable: bool,
}

/// Real process execution that also records its inputs.
pub(crate) struct RecordingProcess {
    /// Actual operating-system adapter.
    inner: Arc<dyn Process + Send + Sync>,
    /// Captured calls in process order.
    pub(crate) requests: Mutex<Vec<CapturedRequest>>,
}

impl Process for RecordingProcess {
    fn execute(&self, request: &Request) -> Result<Output> {
        assert!(request.input.is_none());
        self.requests.lock().unwrap().push(CapturedRequest {
            args: request.args.clone(),
            cwd: request.cwd.clone(),
            git_index: request.git_index.clone(),
            cancellable: request.cancellable,
        });
        self.inner.execute(request)
    }
}

/// Temporary checkout and local bare origin; no network or global Git state.
pub(crate) struct Repository {
    /// Own the containing temporary directory until every child has ended.
    directory: TestDirectory,
    /// Isolated setup and inspection, never recorded as code-under-test requests.
    fixture_git: IsolatedGit,
    /// Actual checkout root.
    pub(crate) root: PathBuf,
    /// Git and script boundary under test.
    pub(crate) scripts: SystemScripts,
    /// Recorded real Git requests.
    pub(crate) process: Arc<RecordingProcess>,
}

impl Repository {
    /// Create a repository with one root commit and a local bare origin.
    pub(crate) fn new() -> Self {
        let directory = TestDirectory::new();
        let fixture_git = IsolatedGit::new(directory.path());
        let root = directory.path().join("repo with space");
        let process = Arc::new(RecordingProcess {
            inner: Arc::new(SystemProcess {
                interrupt: Arc::new(
                    Unimock::new(InterruptRequestedMock.each_call(matching!()).returns(false))
                        .no_verify_in_drop(),
                ),
                clock: Arc::new(
                    Unimock::new(
                        ClockSleepMock
                            .each_call(matching!())
                            .answers(&|_| thread::yield_now()),
                    )
                    .no_verify_in_drop(),
                ),
                logs: Arc::new(Unimock::new(())),
            }),
            requests: Mutex::new(Vec::new()),
        });
        let scripts = SystemScripts {
            process: process.clone(),
            workspace: root.clone(),
        };
        let repository = Self {
            directory,
            fixture_git,
            root,
            scripts,
            process,
        };
        repository.at(
            repository.directory.path(),
            &["init", "--bare", "origin.git"],
        );
        repository.at(
            repository.directory.path(),
            &["init", "--initial-branch=feature", "repo with space"],
        );
        for args in [
            ["config", "user.name", "Adapter Test"],
            ["config", "user.email", "adapter@example.invalid"],
            ["config", "core.hooksPath", "/dev/null"],
        ] {
            repository.git(&args);
        }
        repository.git(&[
            "remote",
            "add",
            "origin",
            repository
                .directory
                .path()
                .join("origin.git")
                .to_str()
                .unwrap(),
        ]);
        fs::write(repository.root.join(".gitignore"), ".context/\nignored-*\n").unwrap();
        repository.commit("m1");
        repository
    }

    /// Inspect or prepare the fixture with isolated config and no request recording.
    pub(crate) fn at(&self, cwd: &Path, args: &[&str]) -> String {
        self.fixture_git.run(cwd, args)
    }

    /// Run Git in the checkout.
    pub(crate) fn git(&self, args: &[&str]) -> String {
        self.at(&self.root, args)
    }

    /// Add one independently named file and commit it.
    pub(crate) fn commit(&self, name: &str) -> CommitSha {
        fs::write(self.root.join(name), format!("{name}\n")).unwrap();
        self.git(&["add", "-A"]);
        self.git(&["commit", "-m", &format!("test: {name}")]);
        self.head()
    }

    /// Read the real validated checkout HEAD.
    pub(crate) fn head(&self) -> CommitSha {
        CommitSha::read(&self.git(&["rev-parse", "HEAD"])).unwrap()
    }

    /// Push a local branch or refspec to the local bare origin.
    pub(crate) fn push(&self, reference: &str) {
        self.git(&["push", "origin", reference]);
    }

    /// Start recording only the operation currently under test.
    pub(crate) fn clear_requests(&self) {
        self.process.requests.lock().unwrap().clear();
    }
}
